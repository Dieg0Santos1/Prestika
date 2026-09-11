-- Pagos inmutables, aplicaciones a cuotas y traslados auditables.

create table public.pagos (
  id uuid primary key default gen_random_uuid(),
  propietario_id uuid not null references auth.users (id) on delete restrict,
  prestamo_id uuid not null references public.prestamos (id) on delete restrict,
  tipo text not null default 'PAGO',
  monto numeric(14,2) not null,
  direccion smallint not null default 1,
  efecto numeric(14,2) generated always as (monto * direccion) stored,
  monto_capital numeric(14,2) not null,
  monto_interes numeric(14,2) not null,
  efecto_capital numeric(14,2) generated always as (monto_capital * direccion) stored,
  efecto_interes numeric(14,2) generated always as (monto_interes * direccion) stored,
  medio text not null,
  nota text,
  pago_revertido_id uuid references public.pagos (id) on delete restrict,
  solicitud_id uuid not null,
  ocurrido_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint pagos_tipo_valido check (tipo in ('PAGO', 'COMPENSACION_RENOVACION', 'REVERSO')),
  constraint pagos_montos_validos check (
    monto > 0 and monto_capital >= 0 and monto_interes >= 0
    and monto = monto_capital + monto_interes
  ),
  constraint pagos_direccion_valida check (direccion in (-1, 1)),
  constraint pagos_medio_valido check (
    medio in ('EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'COMPENSACION', 'OTRO')
  ),
  constraint pagos_tipo_consistente check (
    (tipo = 'PAGO' and direccion = 1 and pago_revertido_id is null and medio <> 'COMPENSACION')
    or (tipo = 'COMPENSACION_RENOVACION' and direccion = 1 and pago_revertido_id is null and medio = 'COMPENSACION')
    or (tipo = 'REVERSO' and direccion = -1 and pago_revertido_id is not null)
  ),
  constraint pagos_nota_valida check (nota is null or char_length(btrim(nota)) between 3 and 500),
  constraint pagos_solicitud_unica unique (propietario_id, solicitud_id),
  constraint pagos_reversion_unica unique (pago_revertido_id)
);

comment on table public.pagos is
  'Ledger inmutable de pagos, compensaciones y reversos. El saldo del préstamo se deriva de efecto.';
comment on column public.pagos.monto_capital is
  'Parte proporcional aplicada al capital; nunca implica que el interés se cobre primero o al final.';

create index pagos_propietario_fecha_idx
  on public.pagos (propietario_id, ocurrido_at desc, id desc);
create index pagos_prestamo_fecha_idx
  on public.pagos (prestamo_id, ocurrido_at desc, id desc);

create table public.aplicaciones_pago_cuota (
  id uuid primary key default gen_random_uuid(),
  propietario_id uuid not null references auth.users (id) on delete restrict,
  pago_id uuid not null references public.pagos (id) on delete restrict,
  cuota_id uuid not null references public.cuotas_prestamo (id) on delete restrict,
  monto numeric(14,2) not null check (monto > 0),
  created_at timestamptz not null default now(),
  constraint aplicaciones_pago_cuota_unica unique (pago_id, cuota_id)
);

create index aplicaciones_cuota_idx on public.aplicaciones_pago_cuota (cuota_id, pago_id);

create table public.traslados_cuota (
  id uuid primary key default gen_random_uuid(),
  propietario_id uuid not null references auth.users (id) on delete restrict,
  prestamo_id uuid not null references public.prestamos (id) on delete restrict,
  pago_id uuid not null unique references public.pagos (id) on delete restrict,
  cuota_origen_id uuid not null references public.cuotas_prestamo (id) on delete restrict,
  cuota_destino_id uuid not null references public.cuotas_prestamo (id) on delete restrict,
  monto numeric(14,2) not null check (monto > 0),
  created_at timestamptz not null default now(),
  constraint traslados_cuotas_distintas check (cuota_origen_id <> cuota_destino_id)
);

create index traslados_prestamo_idx on public.traslados_cuota (prestamo_id, created_at);

alter table public.movimientos_caja
  add column pago_id uuid references public.pagos (id) on delete restrict;

create unique index movimientos_caja_pago_unico_idx
  on public.movimientos_caja (pago_id)
  where pago_id is not null;

alter table public.pagos enable row level security;
alter table public.aplicaciones_pago_cuota enable row level security;
alter table public.traslados_cuota enable row level security;

create policy pagos_select_propios on public.pagos for select to authenticated
using ((select auth.uid()) = propietario_id);
create policy aplicaciones_select_propias on public.aplicaciones_pago_cuota for select to authenticated
using ((select auth.uid()) = propietario_id);
create policy traslados_select_propios on public.traslados_cuota for select to authenticated
using ((select auth.uid()) = propietario_id);

revoke all on table public.pagos from anon, authenticated;
revoke all on table public.aplicaciones_pago_cuota from anon, authenticated;
revoke all on table public.traslados_cuota from anon, authenticated;
grant select on table public.pagos to authenticated;
grant select on table public.aplicaciones_pago_cuota to authenticated;
grant select on table public.traslados_cuota to authenticated;

create or replace function public.validar_reverso_caja_financiero()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_original public.movimientos_caja;
begin
  if new.tipo <> 'REVERSO' then return new; end if;
  select * into v_original from public.movimientos_caja where id = new.movimiento_revertido_id;
  if v_original.prestamo_id is not null and new.pago_id is null then
    raise exception 'Este movimiento financiero debe revertirse desde su préstamo.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger movimientos_caja_validar_reverso_financiero
before insert on public.movimientos_caja
for each row execute function public.validar_reverso_caja_financiero();

create or replace function public.registrar_pago(
  p_prestamo_id uuid,
  p_monto numeric,
  p_medio text,
  p_nota text,
  p_trasladar_restante boolean,
  p_pago_total boolean,
  p_solicitud_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_propietario_id uuid := auth.uid();
  v_prestamo public.prestamos;
  v_cliente public.clientes;
  v_existente_id uuid;
  v_pago_id uuid;
  v_total_pagado numeric(14,2);
  v_interes_pagado numeric(14,2);
  v_saldo numeric(14,2);
  v_nuevo_total numeric(14,2);
  v_nuevo_interes numeric(14,2);
  v_interes_pago numeric(14,2);
  v_capital_pago numeric(14,2);
  v_cuota record;
  v_saldo_cuota numeric(14,2);
  v_siguiente_cuota_id uuid;
begin
  if v_propietario_id is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  if p_solicitud_id is null then
    raise exception 'La operación necesita una clave de solicitud.' using errcode = '22023';
  end if;

  select id into v_existente_id from public.pagos
  where propietario_id = v_propietario_id and solicitud_id = p_solicitud_id;
  if found then return v_existente_id; end if;

  if p_monto is null or p_monto <= 0 or p_monto <> round(p_monto, 2) then
    raise exception 'El pago debe ser positivo y tener máximo dos decimales.' using errcode = '22023';
  end if;
  if p_monto > 999999999999.99 then
    raise exception 'El pago excede el límite permitido.' using errcode = '22003';
  end if;
  if p_medio is null or p_medio not in ('EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'OTRO') then
    raise exception 'Medio de pago no permitido.' using errcode = '22023';
  end if;
  if p_pago_total is null then
    raise exception 'Indica si se está cancelando todo el préstamo.' using errcode = '22023';
  end if;
  if p_nota is not null and btrim(p_nota) <> '' and char_length(btrim(p_nota)) not between 3 and 500 then
    raise exception 'La nota debe tener entre 3 y 500 caracteres.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_propietario_id::text, 0));

  select id into v_existente_id from public.pagos
  where propietario_id = v_propietario_id and solicitud_id = p_solicitud_id;
  if found then return v_existente_id; end if;

  select * into v_prestamo from public.prestamos
  where id = p_prestamo_id and propietario_id = v_propietario_id
  for update;
  if not found then raise exception 'Préstamo no encontrado.' using errcode = 'P0002'; end if;
  if v_prestamo.estado <> 'ACTIVO' then
    raise exception 'Solo se pueden registrar pagos en préstamos activos.' using errcode = '23514';
  end if;

  select * into v_cliente from public.clientes where id = v_prestamo.cliente_id;
  select coalesce(sum(efecto), 0), coalesce(sum(efecto_interes), 0)
    into v_total_pagado, v_interes_pagado
  from public.pagos where prestamo_id = v_prestamo.id;
  v_saldo := v_prestamo.total_a_cobrar - v_total_pagado;

  if p_monto > v_saldo then
    raise exception 'El pago no puede superar el saldo pendiente de S/ %', to_char(v_saldo, 'FM999999999990.00') using errcode = '23514';
  end if;
  if p_pago_total and p_monto <> v_saldo then
    raise exception 'Para cancelar el préstamo, el pago debe ser exactamente el saldo pendiente.' using errcode = '23514';
  end if;

  select detalle.*, detalle.monto_actual - detalle.monto_pagado as saldo_actual
  into v_cuota
  from (
    select q.*,
      q.monto_programado
        + coalesce((select sum(t.monto) from public.traslados_cuota t join public.pagos pg on pg.id = t.pago_id where t.cuota_destino_id = q.id and not exists (select 1 from public.pagos r where r.pago_revertido_id = pg.id)), 0)
        - coalesce((select sum(t.monto) from public.traslados_cuota t join public.pagos pg on pg.id = t.pago_id where t.cuota_origen_id = q.id and not exists (select 1 from public.pagos r where r.pago_revertido_id = pg.id)), 0) as monto_actual,
      coalesce((select sum(a.monto) from public.aplicaciones_pago_cuota a join public.pagos pg on pg.id = a.pago_id where a.cuota_id = q.id and not exists (select 1 from public.pagos r where r.pago_revertido_id = pg.id)), 0) as monto_pagado
    from public.cuotas_prestamo q where q.prestamo_id = v_prestamo.id
  ) detalle
  where detalle.monto_actual - detalle.monto_pagado > 0
  order by detalle.numero limit 1;

  if not found then raise exception 'El plan de cuotas ya no tiene saldo pendiente.' using errcode = '23514'; end if;
  v_saldo_cuota := v_cuota.saldo_actual;
  if not p_pago_total and p_monto > v_saldo_cuota then
    raise exception 'Para un pago de cuota, el máximo actual es S/ %. Usa cancelar préstamo para pagar todo.', to_char(v_saldo_cuota, 'FM999999999990.00') using errcode = '23514';
  end if;

  v_nuevo_total := v_total_pagado + p_monto;
  v_nuevo_interes := case
    when v_nuevo_total = v_prestamo.total_a_cobrar then v_prestamo.monto_interes
    else round(v_nuevo_total * v_prestamo.monto_interes / v_prestamo.total_a_cobrar, 2)
  end;
  v_interes_pago := greatest(0, least(p_monto, v_nuevo_interes - v_interes_pagado));
  v_capital_pago := p_monto - v_interes_pago;

  insert into public.pagos (
    propietario_id, prestamo_id, tipo, monto, direccion, monto_capital,
    monto_interes, medio, nota, solicitud_id
  ) values (
    v_propietario_id, v_prestamo.id, 'PAGO', p_monto, 1, v_capital_pago,
    v_interes_pago, p_medio, nullif(btrim(p_nota), ''), p_solicitud_id
  ) returning id into v_pago_id;

  if p_pago_total then
    insert into public.aplicaciones_pago_cuota (propietario_id, pago_id, cuota_id, monto)
    select v_propietario_id, v_pago_id, detalle.id, detalle.monto_actual - detalle.monto_pagado
    from (
      select q.id, q.numero,
        q.monto_programado
          + coalesce((select sum(t.monto) from public.traslados_cuota t join public.pagos pg on pg.id = t.pago_id where t.cuota_destino_id = q.id and not exists (select 1 from public.pagos r where r.pago_revertido_id = pg.id)), 0)
          - coalesce((select sum(t.monto) from public.traslados_cuota t join public.pagos pg on pg.id = t.pago_id where t.cuota_origen_id = q.id and not exists (select 1 from public.pagos r where r.pago_revertido_id = pg.id)), 0) as monto_actual,
        coalesce((select sum(a.monto) from public.aplicaciones_pago_cuota a join public.pagos pg on pg.id = a.pago_id where a.cuota_id = q.id and pg.id <> v_pago_id and not exists (select 1 from public.pagos r where r.pago_revertido_id = pg.id)), 0) as monto_pagado
      from public.cuotas_prestamo q where q.prestamo_id = v_prestamo.id
    ) detalle
    where detalle.monto_actual - detalle.monto_pagado > 0;
  else
    insert into public.aplicaciones_pago_cuota (propietario_id, pago_id, cuota_id, monto)
    values (v_propietario_id, v_pago_id, v_cuota.id, p_monto);

    if p_monto < v_saldo_cuota and coalesce(p_trasladar_restante, false) then
      select id into v_siguiente_cuota_id from public.cuotas_prestamo
      where prestamo_id = v_prestamo.id and numero = v_cuota.numero + 1;
      if v_siguiente_cuota_id is null then
        raise exception 'La última cuota no tiene una cuota siguiente a la cual trasladar.' using errcode = '23514';
      end if;
      insert into public.traslados_cuota (
        propietario_id, prestamo_id, pago_id, cuota_origen_id, cuota_destino_id, monto
      ) values (
        v_propietario_id, v_prestamo.id, v_pago_id, v_cuota.id, v_siguiente_cuota_id, v_saldo_cuota - p_monto
      );
    end if;
  end if;

  insert into public.movimientos_caja (
    propietario_id, tipo, monto, direccion, medio, nota, prestamo_id, pago_id, solicitud_id
  ) values (
    v_propietario_id, 'COBRO_PRESTAMO', p_monto, 1, p_medio,
    'Pago de préstamo de ' || btrim(v_cliente.nombres || ' ' || coalesce(v_cliente.apellidos, '')),
    v_prestamo.id, v_pago_id, p_solicitud_id
  );

  if v_nuevo_total = v_prestamo.total_a_cobrar then
    update public.prestamos set estado = 'PAGADO' where id = v_prestamo.id;
  end if;
  return v_pago_id;
end;
$$;

create or replace function public.revertir_pago(
  p_pago_id uuid,
  p_motivo text,
  p_solicitud_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_propietario_id uuid := auth.uid();
  v_original public.pagos;
  v_prestamo public.prestamos;
  v_movimiento public.movimientos_caja;
  v_existente_id uuid;
  v_reverso_id uuid;
  v_saldo_caja numeric(14,2);
begin
  if v_propietario_id is null then raise exception 'Debes iniciar sesión.' using errcode = '28000'; end if;
  if p_solicitud_id is null then raise exception 'La operación necesita una clave de solicitud.' using errcode = '22023'; end if;
  if p_motivo is null or char_length(btrim(p_motivo)) not between 3 and 500 then
    raise exception 'Indica un motivo de 3 a 500 caracteres.' using errcode = '22023';
  end if;

  select id into v_existente_id from public.pagos
  where propietario_id = v_propietario_id and solicitud_id = p_solicitud_id;
  if found then return v_existente_id; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_propietario_id::text, 0));
  select * into v_original from public.pagos
  where id = p_pago_id and propietario_id = v_propietario_id for update;
  if not found then raise exception 'Pago no encontrado.' using errcode = 'P0002'; end if;
  if v_original.tipo <> 'PAGO' then raise exception 'Solo se puede revertir un pago recibido.' using errcode = '23514'; end if;
  if exists (select 1 from public.pagos where pago_revertido_id = v_original.id) then
    raise exception 'Este pago ya fue revertido.' using errcode = '23514';
  end if;

  select * into v_prestamo from public.prestamos where id = v_original.prestamo_id for update;
  if v_prestamo.estado not in ('ACTIVO', 'PAGADO') then
    raise exception 'No se puede revertir un pago de un préstamo cerrado por otra operación.' using errcode = '23514';
  end if;
  select coalesce(sum(efecto), 0) into v_saldo_caja from public.movimientos_caja
  where propietario_id = v_propietario_id;
  if v_saldo_caja < v_original.monto then
    raise exception 'No se puede revertir porque la caja quedaría negativa.' using errcode = '23514';
  end if;

  insert into public.pagos (
    propietario_id, prestamo_id, tipo, monto, direccion, monto_capital,
    monto_interes, medio, nota, pago_revertido_id, solicitud_id
  ) values (
    v_propietario_id, v_original.prestamo_id, 'REVERSO', v_original.monto, -1,
    v_original.monto_capital, v_original.monto_interes, v_original.medio,
    btrim(p_motivo), v_original.id, p_solicitud_id
  ) returning id into v_reverso_id;

  select * into v_movimiento from public.movimientos_caja
  where pago_id = v_original.id and tipo = 'COBRO_PRESTAMO';
  if not found then raise exception 'No se encontró el ingreso de Caja asociado al pago.' using errcode = 'P0002'; end if;

  insert into public.movimientos_caja (
    propietario_id, tipo, monto, direccion, medio, nota, movimiento_revertido_id,
    prestamo_id, pago_id, solicitud_id
  ) values (
    v_propietario_id, 'REVERSO', v_original.monto, -1, v_original.medio,
    btrim(p_motivo), v_movimiento.id, v_original.prestamo_id, v_reverso_id, p_solicitud_id
  );

  if v_prestamo.estado = 'PAGADO' then
    update public.prestamos set estado = 'ACTIVO' where id = v_prestamo.id;
  end if;
  return v_reverso_id;
end;
$$;

revoke all on function public.registrar_pago(uuid, numeric, text, text, boolean, boolean, uuid) from public;
revoke all on function public.revertir_pago(uuid, text, uuid) from public;
grant execute on function public.registrar_pago(uuid, numeric, text, text, boolean, boolean, uuid) to authenticated;
grant execute on function public.revertir_pago(uuid, text, uuid) to authenticated;
