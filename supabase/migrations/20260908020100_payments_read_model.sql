-- Modelo de lectura de préstamos derivado de pagos y ajustes inmutables.

create or replace function public.obtener_prestamos(p_cliente_id uuid default null)
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with datos as (
    select
      p.*,
      btrim(c.nombres || ' ' || coalesce(c.apellidos, '')) as cliente_nombre,
      coalesce((select sum(pg.efecto) from public.pagos pg where pg.prestamo_id = p.id), 0)::numeric(14,2) as total_pagado,
      coalesce((select sum(pg.efecto_capital) from public.pagos pg where pg.prestamo_id = p.id), 0)::numeric(14,2) as capital_pagado,
      coalesce((select sum(pg.efecto_interes) from public.pagos pg where pg.prestamo_id = p.id), 0)::numeric(14,2) as interes_pagado,
      coalesce((select sum(case when pg.tipo in ('PAGO', 'REVERSO') then pg.efecto else 0 end) from public.pagos pg where pg.prestamo_id = p.id), 0)::numeric(14,2) as cobrado_efectivo
    from public.prestamos p
    join public.clientes c on c.id = p.cliente_id
    where p.propietario_id = auth.uid()
      and (p_cliente_id is null or p.cliente_id = p_cliente_id)
  )
  select jsonb_build_object(
    'cantidad', count(*)::integer,
    'activos', count(*) filter (where d.estado = 'ACTIVO')::integer,
    'por_cobrar', to_char(
      coalesce(sum(greatest(d.total_a_cobrar - d.total_pagado, 0)) filter (where d.estado = 'ACTIVO'), 0),
      'FM999999999999990.00'
    ),
    'total_cobrado', to_char(coalesce(sum(d.cobrado_efectivo), 0), 'FM999999999999990.00'),
    'ganancia_consolidada', to_char(
      coalesce(sum(d.monto_interes) filter (where d.estado = 'PAGADO'), 0),
      'FM999999999999990.00'
    ),
    'prestamos', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'cliente_id', d.cliente_id,
          'cliente_nombre', d.cliente_nombre,
          'tipo', d.tipo,
          'monto_base', to_char(d.monto_base, 'FM999999999999990.00'),
          'porcentaje_interes', to_char(d.porcentaje_interes, 'FM999990.0000'),
          'monto_interes', to_char(d.monto_interes, 'FM999999999999990.00'),
          'total_a_cobrar', to_char(d.total_a_cobrar, 'FM999999999999990.00'),
          'monto_desembolsado', to_char(d.monto_desembolsado, 'FM999999999999990.00'),
          'saldo_compensado', to_char(d.saldo_compensado, 'FM999999999999990.00'),
          'total_pagado', to_char(d.total_pagado, 'FM999999999999990.00'),
          'capital_pagado', to_char(d.capital_pagado, 'FM999999999999990.00'),
          'interes_pagado', to_char(d.interes_pagado, 'FM999999999999990.00'),
          'saldo_pendiente', to_char(
            case when d.estado = 'ANULADO' then 0 else greatest(d.total_a_cobrar - d.total_pagado, 0) end,
            'FM999999999999990.00'
          ),
          'numero_cuotas', d.numero_cuotas,
          'medio_desembolso', d.medio_desembolso,
          'estado', d.estado,
          'prestamo_origen_id', d.prestamo_origen_id,
          'nota', d.nota,
          'fecha_prestamo', d.fecha_prestamo,
          'cuotas', coalesce(
            (
              select jsonb_agg(
                jsonb_build_object(
                  'id', qd.id,
                  'numero', qd.numero,
                  'monto_programado', to_char(qd.monto_programado, 'FM999999999999990.00'),
                  'monto_actual', to_char(qd.monto_actual, 'FM999999999999990.00'),
                  'monto_pagado', to_char(qd.monto_pagado, 'FM999999999999990.00'),
                  'saldo_pendiente', to_char(greatest(qd.monto_actual - qd.monto_pagado, 0), 'FM999999999999990.00'),
                  'monto_recibido_traslado', to_char(qd.monto_recibido_traslado, 'FM999999999999990.00'),
                  'monto_enviado_traslado', to_char(qd.monto_enviado_traslado, 'FM999999999999990.00'),
                  'estado', case
                    when qd.monto_pagado = 0 then 'PENDIENTE'
                    when qd.monto_pagado >= qd.monto_actual then 'PAGADA'
                    else 'PARCIAL'
                  end
                ) order by qd.numero
              )
              from (
                select
                  q.*,
                  q.monto_programado + incoming.monto - outgoing.monto as monto_actual,
                  applied.monto as monto_pagado,
                  incoming.monto as monto_recibido_traslado,
                  outgoing.monto as monto_enviado_traslado
                from public.cuotas_prestamo q
                cross join lateral (
                  select coalesce(sum(t.monto), 0)::numeric(14,2) as monto
                  from public.traslados_cuota t
                  join public.pagos pg on pg.id = t.pago_id
                  where t.cuota_destino_id = q.id
                    and not exists (select 1 from public.pagos r where r.pago_revertido_id = pg.id)
                ) incoming
                cross join lateral (
                  select coalesce(sum(t.monto), 0)::numeric(14,2) as monto
                  from public.traslados_cuota t
                  join public.pagos pg on pg.id = t.pago_id
                  where t.cuota_origen_id = q.id
                    and not exists (select 1 from public.pagos r where r.pago_revertido_id = pg.id)
                ) outgoing
                cross join lateral (
                  select coalesce(sum(a.monto), 0)::numeric(14,2) as monto
                  from public.aplicaciones_pago_cuota a
                  join public.pagos pg on pg.id = a.pago_id
                  where a.cuota_id = q.id
                    and not exists (select 1 from public.pagos r where r.pago_revertido_id = pg.id)
                ) applied
                where q.prestamo_id = d.id
              ) qd
            ),
            '[]'::jsonb
          ),
          'pagos', coalesce(
            (
              select jsonb_agg(
                jsonb_build_object(
                  'id', pg.id,
                  'tipo', pg.tipo,
                  'monto', to_char(pg.monto, 'FM999999999999990.00'),
                  'direccion', pg.direccion,
                  'monto_capital', to_char(pg.monto_capital, 'FM999999999999990.00'),
                  'monto_interes', to_char(pg.monto_interes, 'FM999999999999990.00'),
                  'medio', pg.medio,
                  'nota', pg.nota,
                  'pago_revertido_id', pg.pago_revertido_id,
                  'esta_revertido', exists (select 1 from public.pagos r where r.pago_revertido_id = pg.id),
                  'ocurrido_at', pg.ocurrido_at,
                  'cuotas', coalesce(
                    (select jsonb_agg(q.numero order by q.numero) from public.aplicaciones_pago_cuota a join public.cuotas_prestamo q on q.id = a.cuota_id where a.pago_id = pg.id),
                    '[]'::jsonb
                  ),
                  'monto_trasladado', to_char(coalesce((select t.monto from public.traslados_cuota t where t.pago_id = pg.id), 0), 'FM999999999999990.00')
                ) order by pg.ocurrido_at desc, pg.id desc
              )
              from public.pagos pg where pg.prestamo_id = d.id
            ),
            '[]'::jsonb
          )
        ) order by d.fecha_prestamo desc, d.id desc
      ),
      '[]'::jsonb
    )
  )
  from datos d;
$$;

