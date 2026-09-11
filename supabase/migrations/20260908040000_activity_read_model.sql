-- Línea de tiempo unificada, derivada de los ledgers existentes y sin duplicar hechos.

create or replace function public.obtener_actividad(p_limite integer default 200)
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with eventos as (
    select
      m.id,
      case when m.tipo = 'REVERSO' then 'REVERSO_CAJA' else m.tipo end as tipo,
      'CAJA'::text as categoria,
      to_char(m.monto, 'FM999999999999990.00') as monto,
      m.direccion,
      m.medio,
      m.nota,
      m.ocurrido_at,
      null::uuid as cliente_id,
      null::text as cliente_nombre,
      null::uuid as prestamo_id,
      null::text as monto_base,
      null::text as monto_interes,
      null::text as total_a_cobrar,
      null::text as monto_desembolsado,
      null::text as saldo_compensado,
      exists (
        select 1 from public.movimientos_caja reverso
        where reverso.movimiento_revertido_id = m.id
      ) as esta_revertido
    from public.movimientos_caja m
    where m.propietario_id = auth.uid()
      and m.prestamo_id is null
      and m.pago_id is null

    union all

    select
      p.id,
      case when p.tipo = 'RENOVACION' then 'RENOVACION' else 'PRESTAMO_CREADO' end,
      case when p.tipo = 'RENOVACION' then 'RENOVACION' else 'PRESTAMO' end,
      to_char(p.monto_desembolsado, 'FM999999999999990.00'),
      -1::smallint,
      p.medio_desembolso,
      p.nota,
      p.fecha_prestamo,
      p.cliente_id,
      btrim(c.nombres || ' ' || coalesce(c.apellidos, '')),
      p.id,
      to_char(p.monto_base, 'FM999999999999990.00'),
      to_char(p.monto_interes, 'FM999999999999990.00'),
      to_char(p.total_a_cobrar, 'FM999999999999990.00'),
      to_char(p.monto_desembolsado, 'FM999999999999990.00'),
      to_char(p.saldo_compensado, 'FM999999999999990.00'),
      p.estado = 'ANULADO'
    from public.prestamos p
    join public.clientes c on c.id = p.cliente_id
    where p.propietario_id = auth.uid()

    union all

    select
      pg.id,
      case when pg.tipo = 'REVERSO' then 'PAGO_REVERTIDO' else 'PAGO_RECIBIDO' end,
      'COBRO'::text,
      to_char(pg.monto, 'FM999999999999990.00'),
      pg.direccion,
      pg.medio,
      pg.nota,
      pg.ocurrido_at,
      p.cliente_id,
      btrim(c.nombres || ' ' || coalesce(c.apellidos, '')),
      pg.prestamo_id,
      null::text,
      to_char(pg.monto_interes, 'FM999999999999990.00'),
      null::text,
      null::text,
      null::text,
      exists (
        select 1 from public.pagos reverso
        where reverso.pago_revertido_id = pg.id
      )
    from public.pagos pg
    join public.prestamos p on p.id = pg.prestamo_id
    join public.clientes c on c.id = p.cliente_id
    where pg.propietario_id = auth.uid()
      and pg.tipo <> 'COMPENSACION_RENOVACION'
  ),
  recientes as (
    select * from eventos
    order by ocurrido_at desc, id desc
    limit greatest(1, least(coalesce(p_limite, 200), 500))
  )
  select jsonb_build_object(
    'cantidad', (select count(*)::integer from eventos),
    'eventos', coalesce(
      (select jsonb_agg(to_jsonb(recientes) order by ocurrido_at desc, id desc) from recientes),
      '[]'::jsonb
    )
  );
$$;

revoke all on function public.obtener_actividad(integer) from public;
grant execute on function public.obtener_actividad(integer) to authenticated;
