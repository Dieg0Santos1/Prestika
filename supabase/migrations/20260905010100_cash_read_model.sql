-- Modelo de lectura: los NUMERIC se entregan como texto para no convertir dinero a float en JavaScript.

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
      coalesce(sum(m.efecto) filter (where m.tipo in ('CAPITAL_INICIAL', 'APORTE_CAPITAL')), 0),
      'FM999999999999990.00'
    ),
    'capital_retirado', to_char(
      coalesce(sum(m.monto) filter (where m.tipo = 'RETIRO_CAPITAL'), 0),
      'FM999999999999990.00'
    ),
    'cobros_recibidos', to_char(
      coalesce(sum(m.efecto) filter (where m.tipo = 'COBRO_PRESTAMO'), 0),
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
        from (
          select *
          from public.movimientos_caja
          where propietario_id = auth.uid()
          order by ocurrido_at desc, id desc
          limit 100
        ) detalle
      ),
      '[]'::jsonb
    )
  )
  from public.movimientos_caja m
  where m.propietario_id = auth.uid();
$$;

revoke all on function public.obtener_caja() from public;
grant execute on function public.obtener_caja() to authenticated;

