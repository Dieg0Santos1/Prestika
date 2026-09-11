-- Compilación base compatible con EAS Update (runtime 1.0.0, canal production).

insert into public.versiones_app (
  plataforma,
  version,
  numero_compilacion,
  compilacion_minima,
  url_descarga,
  titulo,
  mensaje,
  novedades,
  obligatoria
)
values (
  'android',
  '1.0.0',
  2,
  1,
  'https://prestika.programmersa.com/descargas/prestika.apk',
  'Hay una nueva versión de Prestika',
  'Hemos preparado mejoras que requieren actualizar la aplicación.',
  array[
    'Actualizaciones más rápidas desde la aplicación',
    'Avisos claros para nuevas versiones',
    'Mejoras de estabilidad'
  ],
  false
);
