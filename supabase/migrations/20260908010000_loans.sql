-- Préstamos normales: alta atómica, cuotas sin vencimiento y desembolso en caja.

create table public.prestamos (
  id uuid primary key default gen_random_uuid(),
  propietario_id uuid not null references auth.users (id) on delete restrict,
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  tipo text not null default 'NORMAL',
  monto_base numeric(14,2) not null,
  porcentaje_interes numeric(7,4) not null,
  monto_interes numeric(14,2) not null,
  total_a_cobrar numeric(14,2) not null,
  monto_desembolsado numeric(14,2) not null,
  saldo_compensado numeric(14,2) not null default 0,
  numero_cuotas smallint not null,
  medio_desembolso text not null,
  estado text not null default 'ACTIVO',
  prestamo_origen_id uuid references public.prestamos (id) on delete restrict,
  nota text,
  solicitud_id uuid not null,
  fecha_prestamo timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint prestamos_tipo_valido check (tipo in ('NORMAL', 'RENOVACION')),
  constraint prestamos_montos_validos check (
    monto_base > 0
    and monto_interes >= 0
    and total_a_cobrar = monto_base + monto_interes
    and monto_desembolsado >= 0
    and saldo_compensado >= 0
    and monto_desembolsado + saldo_compensado = monto_base
  ),
  constraint prestamos_interes_valido check (
    porcentaje_interes >= 0 and porcentaje_interes <= 999.9999
  ),
  constraint prestamos_cuotas_validas check (numero_cuotas between 1 and 60),
  constraint prestamos_medio_valido check (
    medio_desembolso in ('EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'OTRO')
  ),
  constraint prestamos_estado_valido check (
    estado in ('ACTIVO', 'PAGADO', 'RENOVADO', 'INCOBRABLE', 'ANULADO')
  ),
  constraint prestamos_nota_valida check (
    nota is null or char_length(btrim(nota)) between 3 and 500
  ),
  constraint prestamos_tipo_consistente check (
    (tipo = 'NORMAL' and prestamo_origen_id is null and saldo_compensado = 0 and monto_desembolsado = monto_base)
    or (tipo = 'RENOVACION' and prestamo_origen_id is not null and saldo_compensado > 0)
  ),
  constraint prestamos_solicitud_unica unique (propietario_id, solicitud_id)
);

comment on table public.prestamos is
  'Condiciones financieras inmutables del préstamo. El saldo no se almacena; se deriva de hechos financieros.';
comment on column public.prestamos.porcentaje_interes is
  'Porcentaje configurable con hasta cuatro decimales. El monto de interés se redondea a dos decimales al crear.';

create unique index prestamos_cliente_activo_unico_idx
  on public.prestamos (cliente_id)
  where estado = 'ACTIVO';

create index prestamos_propietario_fecha_idx
  on public.prestamos (propietario_id, fecha_prestamo desc, id desc);

create index prestamos_cliente_fecha_idx
  on public.prestamos (cliente_id, fecha_prestamo desc, id desc);

create table public.cuotas_prestamo (
  id uuid primary key default gen_random_uuid(),
  propietario_id uuid not null references auth.users (id) on delete restrict,
  prestamo_id uuid not null references public.prestamos (id) on delete restrict,
  numero smallint not null,
  monto_programado numeric(14,2) not null,
  created_at timestamptz not null default now(),

  constraint cuotas_numero_valido check (numero between 1 and 60),
  constraint cuotas_monto_positivo check (monto_programado > 0),
  constraint cuotas_numero_unico unique (prestamo_id, numero)
);

comment on table public.cuotas_prestamo is
  'Plan original de cuotas, sin fechas de vencimiento. Los pagos y redistribuciones se registrarán como hechos separados.';

create index cuotas_propietario_prestamo_idx
  on public.cuotas_prestamo (propietario_id, prestamo_id, numero);

alter table public.movimientos_caja
  add column prestamo_id uuid references public.prestamos (id) on delete restrict;

create unique index movimientos_caja_desembolso_prestamo_unico_idx
  on public.movimientos_caja (prestamo_id)
  where tipo = 'DESEMBOLSO_PRESTAMO';

create index movimientos_caja_prestamo_idx
  on public.movimientos_caja (prestamo_id)
  where prestamo_id is not null;

create trigger prestamos_set_updated_at
before update on public.prestamos
for each row execute function public.set_updated_at();

alter table public.prestamos enable row level security;
alter table public.cuotas_prestamo enable row level security;

create policy prestamos_select_propios
on public.prestamos for select to authenticated
using ((select auth.uid()) = propietario_id);

create policy cuotas_select_propias
on public.cuotas_prestamo for select to authenticated
using ((select auth.uid()) = propietario_id);

revoke all on table public.prestamos from anon, authenticated;
revoke all on table public.cuotas_prestamo from anon, authenticated;
grant select on table public.prestamos to authenticated;
grant select on table public.cuotas_prestamo to authenticated;

create or replace function public.crear_prestamo(
  p_cliente_id uuid,
  p_monto_base numeric,
  p_porcentaje_interes numeric,
  p_numero_cuotas integer,
  p_medio_desembolso text,
  p_nota text,
  p_solicitud_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_propietario_id uuid := auth.uid();
  v_cliente public.clientes;
  v_existente_id uuid;
  v_prestamo_id uuid;
  v_saldo_caja numeric(14,2);
  v_interes numeric(14,2);
  v_total numeric(14,2);
  v_total_centimos bigint;
  v_cuota_centimos bigint;
  v_resto_centimos integer;
  v_numero integer;
  v_monto_cuota numeric(14,2);
begin
  if v_propietario_id is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;

  if p_solicitud_id is null then
    raise exception 'La operación necesita una clave de solicitud.' using errcode = '22023';
  end if;

  select id into v_existente_id
  from public.prestamos
  where propietario_id = v_propietario_id and solicitud_id = p_solicitud_id;
  if found then return v_existente_id; end if;

  if p_monto_base is null or p_monto_base <= 0 or p_monto_base <> round(p_monto_base, 2) then
    raise exception 'El monto debe ser positivo y tener como máximo dos decimales.' using errcode = '22023';
  end if;
  if p_monto_base > 999999999999.99 then
    raise exception 'El monto excede el límite permitido.' using errcode = '22003';
  end if;
  if p_porcentaje_interes is null or p_porcentaje_interes < 0 or p_porcentaje_interes > 999.9999 or p_porcentaje_interes <> round(p_porcentaje_interes, 4) then
    raise exception 'El interés debe estar entre 0 y 999.9999 y tener máximo cuatro decimales.' using errcode = '22023';
  end if;
  if p_numero_cuotas is null or p_numero_cuotas not between 1 and 60 then
    raise exception 'El número de cuotas debe estar entre 1 y 60.' using errcode = '22023';
  end if;
  if p_medio_desembolso not in ('EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'OTRO') then
    raise exception 'Medio de desembolso no permitido.' using errcode = '22023';
  end if;
  if p_nota is not null and btrim(p_nota) <> '' and char_length(btrim(p_nota)) not between 3 and 500 then
    raise exception 'La nota debe tener entre 3 y 500 caracteres.' using errcode = '22023';
  end if;

  -- Una sola transacción financiera por propietario a la vez.
  perform pg_advisory_xact_lock(hashtextextended(v_propietario_id::text, 0));

  select id into v_existente_id
  from public.prestamos
  where propietario_id = v_propietario_id and solicitud_id = p_solicitud_id;
  if found then return v_existente_id; end if;

  select * into v_cliente
  from public.clientes
  where id = p_cliente_id and propietario_id = v_propietario_id
  for update;

  if not found then
    raise exception 'Cliente no encontrado.' using errcode = 'P0002';
  end if;
  if v_cliente.estado <> 'ACTIVO' then
    raise exception 'El cliente debe estar activo para recibir un préstamo.' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.prestamos
    where cliente_id = p_cliente_id and estado = 'ACTIVO'
  ) then
    raise exception 'El cliente ya tiene un préstamo activo.' using errcode = '23514';
  end if;

  select coalesce(sum(efecto), 0)::numeric(14,2) into v_saldo_caja
  from public.movimientos_caja
  where propietario_id = v_propietario_id;

  if v_saldo_caja < p_monto_base then
    raise exception 'Caja insuficiente. Disponible: S/ %', to_char(v_saldo_caja, 'FM999999999990.00')
      using errcode = '23514';
  end if;

  v_interes := round(p_monto_base * p_porcentaje_interes / 100, 2);
  v_total := p_monto_base + v_interes;

  if v_total < p_numero_cuotas::numeric / 100 then
    raise exception 'El total es demasiado pequeño para dividirlo entre las cuotas.' using errcode = '23514';
  end if;

  insert into public.prestamos (
    propietario_id, cliente_id, tipo, monto_base, porcentaje_interes,
    monto_interes, total_a_cobrar, monto_desembolsado, saldo_compensado,
    numero_cuotas, medio_desembolso, estado, nota, solicitud_id
  ) values (
    v_propietario_id, p_cliente_id, 'NORMAL', p_monto_base, p_porcentaje_interes,
    v_interes, v_total, p_monto_base, 0,
    p_numero_cuotas, p_medio_desembolso, 'ACTIVO', nullif(btrim(p_nota), ''), p_solicitud_id
  ) returning id into v_prestamo_id;

  v_total_centimos := round(v_total * 100)::bigint;
  v_cuota_centimos := v_total_centimos / p_numero_cuotas;
  v_resto_centimos := (v_total_centimos % p_numero_cuotas)::integer;

  for v_numero in 1..p_numero_cuotas loop
    v_monto_cuota := (v_cuota_centimos + case when v_numero <= v_resto_centimos then 1 else 0 end)::numeric / 100;
    insert into public.cuotas_prestamo (propietario_id, prestamo_id, numero, monto_programado)
    values (v_propietario_id, v_prestamo_id, v_numero, v_monto_cuota);
  end loop;

  insert into public.movimientos_caja (
    propietario_id, tipo, monto, direccion, medio, nota, prestamo_id, solicitud_id
  ) values (
    v_propietario_id,
    'DESEMBOLSO_PRESTAMO',
    p_monto_base,
    -1,
    p_medio_desembolso,
    'Desembolso de préstamo a ' || btrim(v_cliente.nombres || ' ' || coalesce(v_cliente.apellidos, '')),
    v_prestamo_id,
    p_solicitud_id
  );

  return v_prestamo_id;
end;
$$;

revoke all on function public.crear_prestamo(uuid, numeric, numeric, integer, text, text, uuid) from public;
grant execute on function public.crear_prestamo(uuid, numeric, numeric, integer, text, text, uuid) to authenticated;

