-- Renovación atómica: compensación sin efectivo, nuevo préstamo y desembolso real.

create or replace function public.renovar_prestamo(
  p_prestamo_anterior_id uuid,
  p_nuevo_monto_base numeric,
  p_porcentaje_interes numeric,
  p_numero_cuotas integer,
  p_medio_desembolso text,
  p_nota text,
  p_solicitud_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_propietario_id uuid := auth.uid();
  v_anterior public.prestamos;
  v_cliente public.clientes;
  v_existente_id uuid;
  v_nuevo_id uuid;
  v_compensacion_id uuid;
  v_total_pagado numeric(14,2);
  v_capital_pagado numeric(14,2);
  v_interes_pagado numeric(14,2);
  v_saldo_anterior numeric(14,2);
  v_capital_compensado numeric(14,2);
  v_interes_compensado numeric(14,2);
  v_desembolso_real numeric(14,2);
  v_saldo_caja numeric(14,2);
  v_nuevo_interes numeric(14,2);
  v_nuevo_total numeric(14,2);
  v_total_centimos bigint;
  v_cuota_centimos bigint;
  v_resto_centimos integer;
  v_monto_cuota numeric(14,2);
begin
  if v_propietario_id is null then raise exception 'Debes iniciar sesión.' using errcode = '28000'; end if;
  if p_solicitud_id is null then raise exception 'La operación necesita una clave de solicitud.' using errcode = '22023'; end if;

  select id into v_existente_id from public.prestamos
  where propietario_id = v_propietario_id and solicitud_id = p_solicitud_id;
  if found then return v_existente_id; end if;

  if p_nuevo_monto_base is null or p_nuevo_monto_base <= 0 or p_nuevo_monto_base <> round(p_nuevo_monto_base, 2) then
    raise exception 'El nuevo monto debe ser positivo y tener máximo dos decimales.' using errcode = '22023';
  end if;
  if p_nuevo_monto_base > 999999999999.99 then raise exception 'El monto excede el límite permitido.' using errcode = '22003'; end if;
  if p_porcentaje_interes is null or p_porcentaje_interes < 0 or p_porcentaje_interes > 999.9999 or p_porcentaje_interes <> round(p_porcentaje_interes, 4) then
    raise exception 'El interés debe estar entre 0 y 999.9999 y tener máximo cuatro decimales.' using errcode = '22023';
  end if;
  if p_numero_cuotas is null or p_numero_cuotas not between 1 and 60 then
    raise exception 'El número de cuotas debe estar entre 1 y 60.' using errcode = '22023';
  end if;
  if p_medio_desembolso is null or p_medio_desembolso not in ('EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'OTRO') then
    raise exception 'Medio de desembolso no permitido.' using errcode = '22023';
  end if;
  if p_nota is not null and btrim(p_nota) <> '' and char_length(btrim(p_nota)) not between 3 and 500 then
    raise exception 'La nota debe tener entre 3 y 500 caracteres.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_propietario_id::text, 0));
  select id into v_existente_id from public.prestamos
  where propietario_id = v_propietario_id and solicitud_id = p_solicitud_id;
  if found then return v_existente_id; end if;

  select * into v_anterior from public.prestamos
  where id = p_prestamo_anterior_id and propietario_id = v_propietario_id
  for update;
  if not found then raise exception 'Préstamo anterior no encontrado.' using errcode = 'P0002'; end if;
  if v_anterior.estado <> 'ACTIVO' then
    raise exception 'Solo se puede renovar un préstamo activo.' using errcode = '23514';
  end if;

  select * into v_cliente from public.clientes where id = v_anterior.cliente_id for update;
  if v_cliente.estado <> 'ACTIVO' then
    raise exception 'El cliente debe estar activo para renovar.' using errcode = '23514';
  end if;

  select coalesce(sum(efecto), 0), coalesce(sum(efecto_capital), 0), coalesce(sum(efecto_interes), 0)
    into v_total_pagado, v_capital_pagado, v_interes_pagado
  from public.pagos where prestamo_id = v_anterior.id;

  v_saldo_anterior := v_anterior.total_a_cobrar - v_total_pagado;
  if v_saldo_anterior <= 0 then raise exception 'El préstamo no tiene saldo pendiente para renovar.' using errcode = '23514'; end if;
  if p_nuevo_monto_base <= v_saldo_anterior then
    raise exception 'El nuevo monto debe ser mayor al saldo pendiente de S/ %', to_char(v_saldo_anterior, 'FM999999999990.00') using errcode = '23514';
  end if;

  v_desembolso_real := p_nuevo_monto_base - v_saldo_anterior;
  select coalesce(sum(efecto), 0)::numeric(14,2) into v_saldo_caja
  from public.movimientos_caja where propietario_id = v_propietario_id;
  if v_saldo_caja < v_desembolso_real then
    raise exception 'Caja insuficiente. Se deben entregar S/ % y hay S/ % disponibles.',
      to_char(v_desembolso_real, 'FM999999999990.00'), to_char(v_saldo_caja, 'FM999999999990.00') using errcode = '23514';
  end if;

  v_capital_compensado := greatest(v_anterior.monto_base - v_capital_pagado, 0);
  v_interes_compensado := greatest(v_anterior.monto_interes - v_interes_pagado, 0);

  insert into public.pagos (
    propietario_id, prestamo_id, tipo, monto, direccion, monto_capital,
    monto_interes, medio, nota, solicitud_id
  ) values (
    v_propietario_id, v_anterior.id, 'COMPENSACION_RENOVACION', v_saldo_anterior, 1,
    v_capital_compensado, v_interes_compensado, 'COMPENSACION',
    'Saldo cancelado mediante renovación', p_solicitud_id
  ) returning id into v_compensacion_id;

  insert into public.aplicaciones_pago_cuota (propietario_id, pago_id, cuota_id, monto)
  select v_propietario_id, v_compensacion_id, detalle.id, detalle.monto_actual - detalle.monto_pagado
  from (
    select q.id, q.numero,
      q.monto_programado
        + coalesce((select sum(t.monto) from public.traslados_cuota t join public.pagos pg on pg.id = t.pago_id where t.cuota_destino_id = q.id and not exists (select 1 from public.pagos r where r.pago_revertido_id = pg.id)), 0)
        - coalesce((select sum(t.monto) from public.traslados_cuota t join public.pagos pg on pg.id = t.pago_id where t.cuota_origen_id = q.id and not exists (select 1 from public.pagos r where r.pago_revertido_id = pg.id)), 0) as monto_actual,
      coalesce((select sum(a.monto) from public.aplicaciones_pago_cuota a join public.pagos pg on pg.id = a.pago_id where a.cuota_id = q.id and pg.id <> v_compensacion_id and not exists (select 1 from public.pagos r where r.pago_revertido_id = pg.id)), 0) as monto_pagado
    from public.cuotas_prestamo q where q.prestamo_id = v_anterior.id
  ) detalle
  where detalle.monto_actual - detalle.monto_pagado > 0;

  update public.prestamos set estado = 'RENOVADO' where id = v_anterior.id;

  v_nuevo_interes := round(p_nuevo_monto_base * p_porcentaje_interes / 100, 2);
  v_nuevo_total := p_nuevo_monto_base + v_nuevo_interes;
  if v_nuevo_total < p_numero_cuotas::numeric / 100 then
    raise exception 'El total es demasiado pequeño para dividirlo entre las cuotas.' using errcode = '23514';
  end if;

  insert into public.prestamos (
    propietario_id, cliente_id, tipo, monto_base, porcentaje_interes,
    monto_interes, total_a_cobrar, monto_desembolsado, saldo_compensado,
    numero_cuotas, medio_desembolso, estado, prestamo_origen_id, nota, solicitud_id
  ) values (
    v_propietario_id, v_anterior.cliente_id, 'RENOVACION', p_nuevo_monto_base, p_porcentaje_interes,
    v_nuevo_interes, v_nuevo_total, v_desembolso_real, v_saldo_anterior,
    p_numero_cuotas, p_medio_desembolso, 'ACTIVO', v_anterior.id, nullif(btrim(p_nota), ''), p_solicitud_id
  ) returning id into v_nuevo_id;

  v_total_centimos := round(v_nuevo_total * 100)::bigint;
  v_cuota_centimos := v_total_centimos / p_numero_cuotas;
  v_resto_centimos := (v_total_centimos % p_numero_cuotas)::integer;
  for v_numero in 1..p_numero_cuotas loop
    v_monto_cuota := (v_cuota_centimos + case when v_numero <= v_resto_centimos then 1 else 0 end)::numeric / 100;
    insert into public.cuotas_prestamo (propietario_id, prestamo_id, numero, monto_programado)
    values (v_propietario_id, v_nuevo_id, v_numero, v_monto_cuota);
  end loop;

  insert into public.movimientos_caja (
    propietario_id, tipo, monto, direccion, medio, nota, prestamo_id, solicitud_id
  ) values (
    v_propietario_id, 'DESEMBOLSO_PRESTAMO', v_desembolso_real, -1, p_medio_desembolso,
    'Desembolso real de renovación a ' || btrim(v_cliente.nombres || ' ' || coalesce(v_cliente.apellidos, '')),
    v_nuevo_id, p_solicitud_id
  );

  return v_nuevo_id;
end;
$$;

revoke all on function public.renovar_prestamo(uuid, numeric, numeric, integer, text, text, uuid) from public;
grant execute on function public.renovar_prestamo(uuid, numeric, numeric, integer, text, text, uuid) to authenticated;

