-- Versiones nativas publicadas. Las actualizaciones OTA se gestionan con EAS Update.

create table public.versiones_app (
  id uuid primary key default gen_random_uuid(),
  plataforma text not null,
  version text not null,
  numero_compilacion integer not null,
  compilacion_minima integer not null default 1,
  url_descarga text not null,
  titulo text not null default 'Hay una nueva versión de Prestika',
  mensaje text not null default 'Hemos preparado mejoras que requieren actualizar la aplicación.',
  novedades text[] not null default '{}',
  obligatoria boolean not null default false,
  activa boolean not null default true,
  publicada_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint versiones_app_plataforma_valida check (plataforma in ('android', 'ios')),
  constraint versiones_app_version_valida check (char_length(btrim(version)) between 1 and 30),
  constraint versiones_app_numero_compilacion_valido check (numero_compilacion > 0),
  constraint versiones_app_compilacion_minima_valida check (
    compilacion_minima > 0 and compilacion_minima <= numero_compilacion
  ),
  constraint versiones_app_url_segura check (url_descarga ~ '^https://')
);

comment on table public.versiones_app is
  'Catálogo global de versiones nativas usado para avisar sobre APK o builds que no pueden entregarse por OTA.';

create unique index versiones_app_una_activa_por_plataforma
on public.versiones_app (plataforma)
where activa;

create index versiones_app_publicada_at_idx
on public.versiones_app (publicada_at desc);

create trigger versiones_app_set_updated_at
before update on public.versiones_app
for each row execute function public.set_updated_at();

alter table public.versiones_app enable row level security;

create policy versiones_app_select_activa
on public.versiones_app
for select
to authenticated
using (activa);

revoke all on table public.versiones_app from anon;
revoke insert, update, delete on table public.versiones_app from authenticated;
grant select on table public.versiones_app to authenticated;
