-- Perfil visible de cada propietario. La identidad y las sesiones siguen en auth.users.

create table public.usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  celular text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint usuarios_nombre_valido check (
    char_length(btrim(nombre)) between 2 and 100
  ),
  constraint usuarios_celular_valido check (
    celular is null or char_length(btrim(celular)) between 6 and 20
  )
);

comment on table public.usuarios is
  'Perfil privado del propietario autenticado. No almacena credenciales, PIN ni datos biométricos.';

create trigger usuarios_set_updated_at
before update on public.usuarios
for each row execute function public.set_updated_at();

alter table public.usuarios enable row level security;

create policy usuarios_select_propio
on public.usuarios
for select
to authenticated
using ((select auth.uid()) = id);

create policy usuarios_insert_propio
on public.usuarios
for insert
to authenticated
with check ((select auth.uid()) = id);

create policy usuarios_update_propio
on public.usuarios
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

revoke all on table public.usuarios from anon;
revoke delete on table public.usuarios from authenticated;
grant select, insert, update on table public.usuarios to authenticated;

create or replace function public.crear_perfil_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre text;
  v_celular text;
begin
  v_nombre := nullif(btrim(new.raw_user_meta_data ->> 'nombre'), '');
  v_celular := nullif(btrim(new.raw_user_meta_data ->> 'celular'), '');

  insert into public.usuarios (id, nombre, celular)
  values (
    new.id,
    coalesce(v_nombre, split_part(coalesce(new.email, 'Usuario'), '@', 1)),
    v_celular
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.crear_perfil_usuario() from public, anon, authenticated;

create trigger crear_perfil_despues_de_registro
after insert on auth.users
for each row execute function public.crear_perfil_usuario();

-- Conserva acceso para cuentas creadas antes de incorporar los perfiles.
insert into public.usuarios (id, nombre)
select
  usuario.id,
  split_part(coalesce(usuario.email, 'Usuario'), '@', 1)
from auth.users as usuario
on conflict (id) do nothing;
