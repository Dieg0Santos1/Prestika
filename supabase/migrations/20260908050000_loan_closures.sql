-- Cierres excepcionales de préstamos, auditables e idempotentes.

create table public.eventos_prestamo (
  id uuid primary key default gen_random_uuid(),
  propietario_id uuid not null references auth.users (id) on delete restrict,
  prestamo_id uuid not null references public.prestamos (id) on delete restrict,
  tipo text not null,
  saldo_afectado numeric(14,2) not null,
  monto_caja_revertido numeric(14,2) not null default 0,
  motivo text not null,
  solicitud_id uuid not null,
  ocurrido_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint eventos_prestamo_tipo_valido check (tipo in ('INCOBRABLE', 'ANULACION')),
  constraint eventos_prestamo_saldo_valido check (saldo_afectado > 0),
  constraint eventos_prestamo_monto_caja_valido check (
    (tipo = 'INCOBRABLE' and monto_caja_revertido = 0)
    or (tipo = 'ANULACION' and monto_caja_revertido > 0)
  ),
  constraint eventos_prestamo_motivo_valido check (char_length(btrim(motivo)) between 3 and 500),
  constraint eventos_prestamo_cierre_unico unique (prestamo_id),
  constraint eventos_prestamo_solicitud_unica unique (propietario_id, solicitud_id)
);

comment on table public.eventos_prestamo is
  'Hechos inmutables que explican por qué un préstamo salió de la cartera activa sin un pago ordinario.';
comment on column public.eventos_prestamo.monto_caja_revertido is
  'Solo en una anulación: desembolso original devuelto contablemente a Caja mediante un reverso enlazado.';

create index eventos_prestamo_propietario_fecha_idx
  on public.eventos_prestamo (propietario_id, ocurrido_at desc, id desc);

alter table public.eventos_prestamo enable row level security;

create policy eventos_prestamo_select_propios
on public.eventos_prestamo for select to authenticated
using ((select auth.uid()) = propietario_id);

revoke all on table public.eventos_prestamo from anon, authenticated;
grant select on table public.eventos_prestamo to authenticated;

create or replace function public.impedir_mutacion_evento_prestamo()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'Los cierres de préstamo son inmutables; registra un nuevo hecho correctivo.' using errcode = '23514';
end;
$$;

create trigger eventos_prestamo_inmutables
before update or delete on public.eventos_prestamo
for each row execute function public.impedir_mutacion_evento_prestamo();

alter table public.movimientos_caja
  add column evento_prestamo_id uuid references public.eventos_prestamo (id) on delete restrict;

create unique index movimientos_caja_evento_prestamo_unico_idx
  on public.movimientos_caja (evento_prestamo_id)
  where evento_prestamo_id is not null;

alter table public.movimientos_caja
  add constraint movimientos_caja_evento_cierre_consistente check (
    evento_prestamo_id is null or tipo = 'REVERSO'
  );

create or replace function public.validar_reverso_caja_financiero()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_original public.movimientos_caja;
begin
  if new.tipo <> 'REVERSO' then return new; end if;

  select * into v_original
  from public.movimientos_caja
  where id = new.movimiento_revertido_id;

  if v_original.prestamo_id is not null and new.pago_id is null then
    if new.evento_prestamo_id is null
      or new.prestamo_id is distinct from v_original.prestamo_id
      or not exists (
        select 1
        from public.eventos_prestamo e
        where e.id = new.evento_prestamo_id
          and e.propietario_id = new.propietario_id
          and e.prestamo_id = v_original.prestamo_id
          and e.tipo = 'ANULACION'
      ) then
      raise exception 'Este desembolso solo puede revertirse desde una anulación válida del préstamo.' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.cerrar_prestamo(
  p_prestamo_id uuid,
  p_tipo text,
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
  v_prestamo public.prestamos;
  v_evento public.eventos_prestamo;
  v_desembolso public.movimientos_caja;
  v_total_pagado numeric(14,2);
  v_saldo numeric(14,2);
begin
  if v_propietario_id is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  if p_solicitud_id is null then
    raise exception 'La operación necesita una clave de solicitud.' using errcode = '22023';
  end if;
  if p_tipo is null or p_tipo not in ('INCOBRABLE', 'ANULACION') then
    raise exception 'Tipo de cierre no permitido.' using errcode = '22023';
  end if;
  if p_motivo is null or char_length(btrim(p_motivo)) not between 3 and 500 then
    raise exception 'Indica un motivo de 3 a 500 caracteres.' using errcode = '22023';
  end if;

  select * into v_evento
  from public.eventos_prestamo
  where propietario_id = v_propietario_id and solicitud_id = p_solicitud_id;
  if found then return v_evento.id; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_propietario_id::text, 0));

  select * into v_evento
  from public.eventos_prestamo
  where propietario_id = v_propietario_id and solicitud_id = p_solicitud_id;
  if found then return v_evento.id; end if;

  select * into v_prestamo
  from public.prestamos
  where id = p_prestamo_id and propietario_id = v_propietario_id
  for update;

  if not found then
    raise exception 'Préstamo no encontrado.' using errcode = 'P0002';
  end if;
  if v_prestamo.estado <> 'ACTIVO' then
    raise exception 'Solo se puede cerrar un préstamo activo.' using errcode = '23514';
  end if;

  select coalesce(sum(efecto), 0)::numeric(14,2)
    into v_total_pagado
  from public.pagos
  where prestamo_id = v_prestamo.id;

  v_saldo := v_prestamo.total_a_cobrar - v_total_pagado;
  if v_saldo <= 0 then
    raise exception 'El préstamo no tiene saldo pendiente para cerrar.' using errcode = '23514';
  end if;

  if p_tipo = 'ANULACION' then
    if v_prestamo.tipo <> 'NORMAL' then
      raise exception 'Una renovación no puede anularse de forma aislada porque está enlazada al préstamo anterior.' using errcode = '23514';
    end if;
    if v_total_pagado <> 0 then
      raise exception 'No se puede anular un préstamo con pagos aplicados. Si el dinero se entregó y no será recuperado, márcalo como incobrable.' using errcode = '23514';
    end if;

    select * into v_desembolso
    from public.movimientos_caja
    where propietario_id = v_propietario_id
      and prestamo_id = v_prestamo.id
      and tipo = 'DESEMBOLSO_PRESTAMO'
    for update;

    if not found then
      raise exception 'No se encontró el desembolso original del préstamo.' using errcode = 'P0002';
    end if;
    if exists (
      select 1 from public.movimientos_caja
      where movimiento_revertido_id = v_desembolso.id
    ) then
      raise exception 'El desembolso de este préstamo ya fue revertido.' using errcode = '23514';
    end if;

    insert into public.eventos_prestamo (
      propietario_id, prestamo_id, tipo, saldo_afectado,
      monto_caja_revertido, motivo, solicitud_id
    ) values (
      v_propietario_id, v_prestamo.id, 'ANULACION', v_saldo,
      v_desembolso.monto, btrim(p_motivo), p_solicitud_id
    ) returning * into v_evento;

    insert into public.movimientos_caja (
      propietario_id, tipo, monto, direccion, medio, nota,
      movimiento_revertido_id, solicitud_id, prestamo_id, evento_prestamo_id
    ) values (
      v_propietario_id, 'REVERSO', v_desembolso.monto, -v_desembolso.direccion,
      v_desembolso.medio, btrim(p_motivo), v_desembolso.id,
      p_solicitud_id, v_prestamo.id, v_evento.id
    );

    update public.prestamos set estado = 'ANULADO' where id = v_prestamo.id;
  else
    insert into public.eventos_prestamo (
      propietario_id, prestamo_id, tipo, saldo_afectado,
      monto_caja_revertido, motivo, solicitud_id
    ) values (
      v_propietario_id, v_prestamo.id, 'INCOBRABLE', v_saldo,
      0, btrim(p_motivo), p_solicitud_id
    ) returning * into v_evento;

    update public.prestamos set estado = 'INCOBRABLE' where id = v_prestamo.id;
  end if;

  return v_evento.id;
end;
$$;

revoke all on function public.cerrar_prestamo(uuid, text, text, uuid) from public;
grant execute on function public.cerrar_prestamo(uuid, text, text, uuid) to authenticated;

create or replace function public.obtener_cierre_prestamo(p_prestamo_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'id', e.id,
        'tipo', e.tipo,
        'saldo_afectado', to_char(e.saldo_afectado, 'FM999999999999990.00'),
        'monto_caja_revertido', to_char(e.monto_caja_revertido, 'FM999999999999990.00'),
        'motivo', e.motivo,
        'ocurrido_at', e.ocurrido_at
      )
      from public.eventos_prestamo e
      where e.propietario_id = auth.uid() and e.prestamo_id = p_prestamo_id
    ),
    'null'::jsonb
  );
$$;

revoke all on function public.obtener_cierre_prestamo(uuid) from public;
grant execute on function public.obtener_cierre_prestamo(uuid) to authenticated;

create or replace function public.obtener_actividad(p_limite integer default 200)
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with eventos as (
    select
      m.id,
      case when m.tipo = 'REVERSO' then 'REVERSO_CAJA' else m.tipo end as tipo,
      'CAJA'::text as categoria,
      to_char(m.monto, 'FM999999999999990.00') as monto,
      m.direccion,
      m.medio,
      m.nota,
      m.ocurrido_at,
      null::uuid as cliente_id,
      null::text as cliente_nombre,
      null::uuid as prestamo_id,
      null::text as monto_base,
      null::text as monto_interes,
      null::text as total_a_cobrar,
      null::text as monto_desembolsado,
      null::text as saldo_compensado,
      exists (select 1 from public.movimientos_caja reverso where reverso.movimiento_revertido_id = m.id) as esta_revertido
    from public.movimientos_caja m
    where m.propietario_id = auth.uid()
      and m.prestamo_id is null
      and m.pago_id is null

    union all

    select
      p.id,
      case when p.tipo = 'RENOVACION' then 'RENOVACION' else 'PRESTAMO_CREADO' end,
      case when p.tipo = 'RENOVACION' then 'RENOVACION' else 'PRESTAMO' end,
      to_char(p.monto_desembolsado, 'FM999999999999990.00'),
      -1::smallint,
      p.medio_desembolso,
      p.nota,
      p.fecha_prestamo,
      p.cliente_id,
      btrim(c.nombres || ' ' || coalesce(c.apellidos, '')),
      p.id,
      to_char(p.monto_base, 'FM999999999999990.00'),
      to_char(p.monto_interes, 'FM999999999999990.00'),
      to_char(p.total_a_cobrar, 'FM999999999999990.00'),
      to_char(p.monto_desembolsado, 'FM999999999999990.00'),
      to_char(p.saldo_compensado, 'FM999999999999990.00'),
      p.estado = 'ANULADO'
    from public.prestamos p
    join public.clientes c on c.id = p.cliente_id
    where p.propietario_id = auth.uid()

    union all

    select
      pg.id,
      case when pg.tipo = 'REVERSO' then 'PAGO_REVERTIDO' else 'PAGO_RECIBIDO' end,
      'COBRO'::text,
      to_char(pg.monto, 'FM999999999999990.00'),
      pg.direccion,
      pg.medio,
      pg.nota,
      pg.ocurrido_at,
      p.cliente_id,
      btrim(c.nombres || ' ' || coalesce(c.apellidos, '')),
      pg.prestamo_id,
      null::text,
      to_char(pg.monto_interes, 'FM999999999999990.00'),
      null::text,
      null::text,
      null::text,
      exists (select 1 from public.pagos reverso where reverso.pago_revertido_id = pg.id)
    from public.pagos pg
    join public.prestamos p on p.id = pg.prestamo_id
    join public.clientes c on c.id = p.cliente_id
    where pg.propietario_id = auth.uid()
      and pg.tipo <> 'COMPENSACION_RENOVACION'

    union all

    select
      e.id,
      case when e.tipo = 'INCOBRABLE' then 'PRESTAMO_INCOBRABLE' else 'PRESTAMO_ANULADO' end,
      'CIERRE'::text,
      to_char(e.saldo_afectado, 'FM999999999999990.00'),
      0::smallint,
      'NO_APLICA'::text,
      e.motivo,
      e.ocurrido_at,
      p.cliente_id,
      btrim(c.nombres || ' ' || coalesce(c.apellidos, '')),
      p.id,
      to_char(p.monto_base, 'FM999999999999990.00'),
      to_char(p.monto_interes, 'FM999999999999990.00'),
      to_char(p.total_a_cobrar, 'FM999999999999990.00'),
      to_char(e.monto_caja_revertido, 'FM999999999999990.00'),
      null::text,
      false
    from public.eventos_prestamo e
    join public.prestamos p on p.id = e.prestamo_id
    join public.clientes c on c.id = p.cliente_id
    where e.propietario_id = auth.uid()
  ),
  recientes as (
    select * from eventos
    order by ocurrido_at desc, id desc
    limit greatest(1, least(coalesce(p_limite, 200), 500))
  )
  select jsonb_build_object(
    'cantidad', (select count(*)::integer from eventos),
    'eventos', coalesce(
      (select jsonb_agg(to_jsonb(recientes) order by ocurrido_at desc, id desc) from recientes),
      '[]'::jsonb
    )
  );
$$;

revoke all on function public.obtener_actividad(integer) from public;
grant execute on function public.obtener_actividad(integer) to authenticated;
