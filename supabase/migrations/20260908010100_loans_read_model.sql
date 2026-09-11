-- Modelo de lectura: dinero y porcentajes viajan como texto, nunca como float.

create or replace function public.obtener_prestamos(p_cliente_id uuid default null)
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'cantidad', count(*)::integer,
    'activos', count(*) filter (where p.estado = 'ACTIVO')::integer,
    'por_cobrar', to_char(
      coalesce(sum(p.total_a_cobrar) filter (where p.estado = 'ACTIVO'), 0),
      'FM999999999999990.00'
    ),
    'prestamos', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'cliente_id', p.cliente_id,
          'cliente_nombre', btrim(c.nombres || ' ' || coalesce(c.apellidos, '')),
          'tipo', p.tipo,
          'monto_base', to_char(p.monto_base, 'FM999999999999990.00'),
          'porcentaje_interes', to_char(p.porcentaje_interes, 'FM999990.0000'),
          'monto_interes', to_char(p.monto_interes, 'FM999999999999990.00'),
          'total_a_cobrar', to_char(p.total_a_cobrar, 'FM999999999999990.00'),
          'monto_desembolsado', to_char(p.monto_desembolsado, 'FM999999999999990.00'),
          'saldo_compensado', to_char(p.saldo_compensado, 'FM999999999999990.00'),
          'saldo_pendiente', to_char(
            case when p.estado in ('PAGADO', 'RENOVADO', 'ANULADO') then 0 else p.total_a_cobrar end,
            'FM999999999999990.00'
          ),
          'numero_cuotas', p.numero_cuotas,
          'medio_desembolso', p.medio_desembolso,
          'estado', p.estado,
          'prestamo_origen_id', p.prestamo_origen_id,
          'nota', p.nota,
          'fecha_prestamo', p.fecha_prestamo,
          'cuotas', coalesce(
            (
              select jsonb_agg(
                jsonb_build_object(
                  'id', q.id,
                  'numero', q.numero,
                  'monto_programado', to_char(q.monto_programado, 'FM999999999999990.00')
                ) order by q.numero
              )
              from public.cuotas_prestamo q
              where q.prestamo_id = p.id
            ),
            '[]'::jsonb
          )
        ) order by p.fecha_prestamo desc, p.id desc
      ),
      '[]'::jsonb
    )
  )
  from public.prestamos p
  join public.clientes c on c.id = p.cliente_id
  where p.propietario_id = auth.uid()
    and (p_cliente_id is null or p.cliente_id = p_cliente_id);
$$;

revoke all on function public.obtener_prestamos(uuid) from public;
grant execute on function public.obtener_prestamos(uuid) to authenticated;

