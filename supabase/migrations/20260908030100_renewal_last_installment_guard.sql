-- Una renovación solo compensa la última cuota pendiente del préstamo anterior.

create or replace function public.validar_compensacion_ultima_cuota()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_numero_cuotas integer;
  v_cuotas_pendientes integer;
  v_numero_pendiente integer;
begin
  if new.tipo <> 'COMPENSACION_RENOVACION' then
    return new;
  end if;

  select numero_cuotas into v_numero_cuotas
  from public.prestamos
  where id = new.prestamo_id and propietario_id = new.propietario_id;

  if not found then
    raise exception 'Préstamo no encontrado para la compensación.' using errcode = 'P0002';
  end if;

  with saldos as (
    select q.numero,
      q.monto_programado
        + coalesce((select sum(t.monto) from public.traslados_cuota t join public.pagos pg on pg.id = t.pago_id where t.cuota_destino_id = q.id and not exists (select 1 from public.pagos r where r.pago_revertido_id = pg.id)), 0)
        - coalesce((select sum(t.monto) from public.traslados_cuota t join public.pagos pg on pg.id = t.pago_id where t.cuota_origen_id = q.id and not exists (select 1 from public.pagos r where r.pago_revertido_id = pg.id)), 0)
        - coalesce((select sum(a.monto) from public.aplicaciones_pago_cuota a join public.pagos pg on pg.id = a.pago_id where a.cuota_id = q.id and not exists (select 1 from public.pagos r where r.pago_revertido_id = pg.id)), 0) as saldo
    from public.cuotas_prestamo q
    where q.prestamo_id = new.prestamo_id
  )
  select count(*), max(numero) into v_cuotas_pendientes, v_numero_pendiente
  from saldos where saldo > 0;

  if v_cuotas_pendientes <> 1 or v_numero_pendiente <> v_numero_cuotas then
    raise exception 'La renovación solo está disponible cuando queda pendiente únicamente la última cuota.' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists validar_compensacion_ultima_cuota on public.pagos;
create trigger validar_compensacion_ultima_cuota
before insert on public.pagos
for each row execute function public.validar_compensacion_ultima_cuota();

revoke all on function public.validar_compensacion_ultima_cuota() from public;
