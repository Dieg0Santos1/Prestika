-- Caja conserva sus acumulados historicos, pero entrega solo el detalle del mes
-- actual. La trazabilidad de meses anteriores sigue disponible en Actividad.

create or replace function public.obtener_caja()
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'saldo', to_char(coalesce(sum(m.efecto), 0), 'FM999999999999990.00'),
    'capital_aportado', to_char(
      coalesce(sum(
        case
          when m.tipo in ('CAPITAL_INICIAL', 'APORTE_CAPITAL') then m.efecto
          when m.tipo = 'REVERSO' and original.tipo in ('CAPITAL_INICIAL', 'APORTE_CAPITAL') then m.efecto
          else 0
        end
      ), 0),
      'FM999999999999990.00'
    ),
    'capital_retirado', to_char(
      -coalesce(sum(
        case
          when m.tipo = 'RETIRO_CAPITAL' then m.efecto
          when m.tipo = 'REVERSO' and original.tipo = 'RETIRO_CAPITAL' then m.efecto
          else 0
        end
      ), 0),
      'FM999999999999990.00'
    ),
    'cobros_recibidos', to_char(
      coalesce(sum(
        case
          when m.tipo = 'COBRO_PRESTAMO' then m.efecto
          when m.tipo = 'REVERSO' and original.tipo = 'COBRO_PRESTAMO' then m.efecto
          else 0
        end
      ), 0),
      'FM999999999999990.00'
    ),
    'cantidad_movimientos', count(*)::integer,
    'movimientos', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', detalle.id,
            'tipo', detalle.tipo,
            'monto', to_char(detalle.monto, 'FM999999999999990.00'),
            'efecto', to_char(detalle.efecto, 'FM999999999999990.00'),
            'direccion', detalle.direccion,
            'medio', detalle.medio,
            'nota', detalle.nota,
            'movimiento_revertido_id', detalle.movimiento_revertido_id,
            'ocurrido_at', detalle.ocurrido_at,
            'esta_revertido', exists (
              select 1
              from public.movimientos_caja reverso
              where reverso.movimiento_revertido_id = detalle.id
            )
          )
          order by detalle.ocurrido_at desc, detalle.id desc
        )
        from public.movimientos_caja detalle
        where detalle.propietario_id = auth.uid()
          and detalle.ocurrido_at >= (date_trunc('month', now() at time zone 'America/Lima') at time zone 'America/Lima')
          and detalle.ocurrido_at < ((date_trunc('month', now() at time zone 'America/Lima') + interval '1 month') at time zone 'America/Lima')
      ),
      '[]'::jsonb
    )
  )
  from public.movimientos_caja m
  left join public.movimientos_caja original on original.id = m.movimiento_revertido_id
  where m.propietario_id = auth.uid();
$$;

comment on function public.obtener_caja() is
  'Devuelve acumulados auditables de caja y el detalle del mes corriente en America/Lima.';
