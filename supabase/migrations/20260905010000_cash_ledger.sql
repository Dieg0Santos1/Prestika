-- Caja única del propietario. Los movimientos son inmutables y el saldo se deriva.

create table public.movimientos_caja (
  id uuid primary key default gen_random_uuid(),
  propietario_id uuid not null default auth.uid() references auth.users (id) on delete restrict,
  tipo text not null,
  monto numeric(14,2) not null,
  direccion smallint not null,
  efecto numeric(14,2) generated always as (monto * direccion) stored,
  medio text not null,
  nota text,
  movimiento_revertido_id uuid references public.movimientos_caja (id) on delete restrict,
  solicitud_id uuid not null,
  ocurrido_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint movimientos_caja_tipo_valido check (
    tipo in (
      'CAPITAL_INICIAL',
      'APORTE_CAPITAL',
      'RETIRO_CAPITAL',
      'DESEMBOLSO_PRESTAMO',
      'COBRO_PRESTAMO',
      'REVERSO'
    )
  ),
  constraint movimientos_caja_monto_positivo check (monto > 0),
  constraint movimientos_caja_direccion_valida check (direccion in (-1, 1)),
  constraint movimientos_caja_medio_valido check (
    medio in ('EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'COMPENSACION', 'OTRO')
  ),
  constraint movimientos_caja_nota_valida check (
    nota is null or char_length(btrim(nota)) between 3 and 500
  ),
  constraint movimientos_caja_reverso_consistente check (
    (tipo = 'REVERSO' and movimiento_revertido_id is not null)
    or (tipo <> 'REVERSO' and movimiento_revertido_id is null)
  ),
  constraint movimientos_caja_solicitud_unica unique (propietario_id, solicitud_id),
  constraint movimientos_caja_reversion_unica unique (movimiento_revertido_id)
);

comment on table public.movimientos_caja is
  'Ledger inmutable de la caja única de cada propietario. No se actualiza ni elimina.';
comment on column public.movimientos_caja.direccion is
  '1 aumenta la caja y -1 la disminuye. Solo las funciones de dominio pueden insertar.';
comment on column public.movimientos_caja.solicitud_id is
  'Clave idempotente generada por el cliente para evitar operaciones duplicadas.';

create index movimientos_caja_propietario_fecha_idx
  on public.movimientos_caja (propietario_id, ocurrido_at desc, id desc);

create index movimientos_caja_propietario_tipo_idx
  on public.movimientos_caja (propietario_id, tipo);

alter table public.movimientos_caja enable row level security;

create policy movimientos_caja_select_propios
on public.movimientos_caja
for select
to authenticated
using ((select auth.uid()) = propietario_id);

revoke all on table public.movimientos_caja from anon, authenticated;
grant select on table public.movimientos_caja to authenticated;

create or replace function public.registrar_movimiento_caja(
  p_tipo text,
  p_monto numeric,
  p_medio text,
  p_nota text,
  p_solicitud_id uuid
)
returns public.movimientos_caja
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_propietario_id uuid := auth.uid();
  v_existente public.movimientos_caja;
  v_saldo numeric(14,2);
  v_direccion smallint;
  v_resultado public.movimientos_caja;
begin
  if v_propietario_id is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;

  if p_solicitud_id is null then
    raise exception 'La operación necesita una clave de solicitud.' using errcode = '22023';
  end if;

  select * into v_existente
  from public.movimientos_caja
  where propietario_id = v_propietario_id and solicitud_id = p_solicitud_id;

  if found then
    return v_existente;
  end if;

  if p_tipo not in ('CAPITAL_INICIAL', 'APORTE_CAPITAL', 'RETIRO_CAPITAL') then
    raise exception 'Tipo de movimiento manual no permitido.' using errcode = '22023';
  end if;

  if p_monto is null or p_monto <= 0 or p_monto <> round(p_monto, 2) then
    raise exception 'El monto debe ser positivo y tener como máximo dos decimales.' using errcode = '22023';
  end if;

  if p_monto > 999999999999.99 then
    raise exception 'El monto excede el límite permitido.' using errcode = '22003';
  end if;

  if p_medio not in ('EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'OTRO') then
    raise exception 'Medio de movimiento no permitido.' using errcode = '22023';
  end if;

  if p_nota is not null and char_length(btrim(p_nota)) not between 3 and 500 then
    raise exception 'La nota debe tener entre 3 y 500 caracteres.' using errcode = '22023';
  end if;

  -- Serializa todas las modificaciones de la caja de este propietario.
  perform pg_advisory_xact_lock(hashtextextended(v_propietario_id::text, 0));

  if p_tipo = 'CAPITAL_INICIAL' and exists (
    select 1 from public.movimientos_caja where propietario_id = v_propietario_id
  ) then
    raise exception 'El capital inicial solo puede registrarse como primer movimiento.' using errcode = '23514';
  end if;

  select coalesce(sum(efecto), 0)::numeric(14,2) into v_saldo
  from public.movimientos_caja
  where propietario_id = v_propietario_id;

  v_direccion := case when p_tipo = 'RETIRO_CAPITAL' then -1 else 1 end;

  if v_direccion = -1 and v_saldo < p_monto then
    raise exception 'Saldo insuficiente. Disponible: S/ %', to_char(v_saldo, 'FM999999999990.00')
      using errcode = '23514';
  end if;

  insert into public.movimientos_caja (
    propietario_id, tipo, monto, direccion, medio, nota, solicitud_id
  ) values (
    v_propietario_id,
    p_tipo,
    p_monto::numeric(14,2),
    v_direccion,
    p_medio,
    nullif(btrim(p_nota), ''),
    p_solicitud_id
  )
  returning * into v_resultado;

  return v_resultado;
end;
$$;

create or replace function public.revertir_movimiento_caja(
  p_movimiento_id uuid,
  p_motivo text,
  p_solicitud_id uuid
)
returns public.movimientos_caja
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_propietario_id uuid := auth.uid();
  v_original public.movimientos_caja;
  v_existente public.movimientos_caja;
  v_saldo numeric(14,2);
  v_resultado public.movimientos_caja;
begin
  if v_propietario_id is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;

  if p_solicitud_id is null then
    raise exception 'La operación necesita una clave de solicitud.' using errcode = '22023';
  end if;

  if p_motivo is null or char_length(btrim(p_motivo)) not between 3 and 500 then
    raise exception 'Indica un motivo de 3 a 500 caracteres.' using errcode = '22023';
  end if;

  select * into v_existente
  from public.movimientos_caja
  where propietario_id = v_propietario_id and solicitud_id = p_solicitud_id;

  if found then
    return v_existente;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_propietario_id::text, 0));

  select * into v_original
  from public.movimientos_caja
  where id = p_movimiento_id and propietario_id = v_propietario_id
  for update;

  if not found then
    raise exception 'Movimiento no encontrado.' using errcode = 'P0002';
  end if;

  if v_original.tipo = 'REVERSO' then
    raise exception 'Un reverso no puede volver a revertirse.' using errcode = '23514';
  end if;

  if exists (
    select 1 from public.movimientos_caja where movimiento_revertido_id = v_original.id
  ) then
    raise exception 'Este movimiento ya fue revertido.' using errcode = '23514';
  end if;

  select coalesce(sum(efecto), 0)::numeric(14,2) into v_saldo
  from public.movimientos_caja
  where propietario_id = v_propietario_id;

  if v_original.direccion = 1 and v_saldo < v_original.monto then
    raise exception 'No se puede revertir porque la caja quedaría con saldo negativo.' using errcode = '23514';
  end if;

  insert into public.movimientos_caja (
    propietario_id,
    tipo,
    monto,
    direccion,
    medio,
    nota,
    movimiento_revertido_id,
    solicitud_id
  ) values (
    v_propietario_id,
    'REVERSO',
    v_original.monto,
    -v_original.direccion,
    v_original.medio,
    btrim(p_motivo),
    v_original.id,
    p_solicitud_id
  )
  returning * into v_resultado;

  return v_resultado;
end;
$$;

revoke all on function public.registrar_movimiento_caja(text, numeric, text, text, uuid) from public;
revoke all on function public.revertir_movimiento_caja(uuid, text, uuid) from public;
grant execute on function public.registrar_movimiento_caja(text, numeric, text, text, uuid) to authenticated;
grant execute on function public.revertir_movimiento_caja(uuid, text, uuid) to authenticated;

