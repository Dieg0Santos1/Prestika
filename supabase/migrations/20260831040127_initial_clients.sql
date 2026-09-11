-- Primera vertical funcional: clientes privados por usuario autenticado.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  propietario_id uuid not null default auth.uid() references auth.users (id) on delete restrict,
  nombres text not null,
  apellidos text,
  celular text,
  metodo_pago_preferido text,
  numero_yape_plin text,
  observaciones text,
  estado text not null default 'ACTIVO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint clientes_nombres_validos check (
    char_length(btrim(nombres)) between 2 and 100
  ),
  constraint clientes_apellidos_validos check (
    apellidos is null or char_length(btrim(apellidos)) between 2 and 100
  ),
  constraint clientes_celular_valido check (
    celular is null or char_length(btrim(celular)) between 6 and 20
  ),
  constraint clientes_metodo_pago_valido check (
    metodo_pago_preferido is null
    or metodo_pago_preferido in ('EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'OTRO')
  ),
  constraint clientes_estado_valido check (
    estado in ('ACTIVO', 'INACTIVO')
  )
);

comment on table public.clientes is
  'Clientes privados del propietario autenticado. No se eliminan físicamente; se inactivan.';
comment on column public.clientes.numero_yape_plin is
  'Número informativo asociado a Yape o Plin cuando corresponda.';

create index clientes_propietario_estado_idx
  on public.clientes (propietario_id, estado);

create index clientes_propietario_nombre_idx
  on public.clientes (propietario_id, lower(nombres), lower(coalesce(apellidos, '')));

create trigger clientes_set_updated_at
before update on public.clientes
for each row execute function public.set_updated_at();

alter table public.clientes enable row level security;

create policy clientes_select_propios
on public.clientes
for select
to authenticated
using ((select auth.uid()) = propietario_id);

create policy clientes_insert_propios
on public.clientes
for insert
to authenticated
with check ((select auth.uid()) = propietario_id);

create policy clientes_update_propios
on public.clientes
for update
to authenticated
using ((select auth.uid()) = propietario_id)
with check ((select auth.uid()) = propietario_id);

revoke all on table public.clientes from anon;
revoke delete on table public.clientes from authenticated;
grant select, insert, update on table public.clientes to authenticated;
