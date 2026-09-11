import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/database';
import { moneyToDatabase, type CashMovementFormValues } from './schema';

export type CashMovementType =
  | 'CAPITAL_INICIAL'
  | 'APORTE_CAPITAL'
  | 'RETIRO_CAPITAL'
  | 'DESEMBOLSO_PRESTAMO'
  | 'COBRO_PRESTAMO'
  | 'REVERSO';

export type CashMovement = {
  id: string;
  tipo: CashMovementType;
  monto: string;
  efecto: string;
  direccion: 1 | -1;
  medio: string;
  nota: string | null;
  movimiento_revertido_id: string | null;
  ocurrido_at: string;
  esta_revertido: boolean;
};

export type CashSummary = {
  saldo: string;
  capital_aportado: string;
  capital_retirado: string;
  cobros_recibidos: string;
  cantidad_movimientos: number;
  movimientos: CashMovement[];
};

function client() {
  if (!supabase) throw new Error('Supabase no está configurado.');
  return supabase;
}

function asObject(value: Json): Record<string, Json | undefined> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Supabase devolvió un resumen de caja inválido.');
  }
  return value;
}

function textValue(value: Json | undefined, fallback = '0.00') {
  return typeof value === 'string' ? value : fallback;
}

export async function getCashSummary(): Promise<CashSummary> {
  const { data, error } = await client().rpc('obtener_caja');
  if (error) throw error;
  const object = asObject(data);
  const rawMovements = Array.isArray(object.movimientos) ? object.movimientos : [];

  return {
    saldo: textValue(object.saldo),
    capital_aportado: textValue(object.capital_aportado),
    capital_retirado: textValue(object.capital_retirado),
    cobros_recibidos: textValue(object.cobros_recibidos),
    cantidad_movimientos: typeof object.cantidad_movimientos === 'number' ? object.cantidad_movimientos : 0,
    movimientos: rawMovements.map((item) => {
      const movement = asObject(item);
      return {
        id: textValue(movement.id, ''),
        tipo: textValue(movement.tipo) as CashMovementType,
        monto: textValue(movement.monto),
        efecto: textValue(movement.efecto),
        direccion: movement.direccion === -1 ? -1 : 1,
        medio: textValue(movement.medio),
        nota: typeof movement.nota === 'string' ? movement.nota : null,
        movimiento_revertido_id: typeof movement.movimiento_revertido_id === 'string' ? movement.movimiento_revertido_id : null,
        ocurrido_at: textValue(movement.ocurrido_at),
        esta_revertido: movement.esta_revertido === true,
      };
    }),
  };
}

export async function registerCashMovement(
  type: Extract<CashMovementType, 'CAPITAL_INICIAL' | 'APORTE_CAPITAL' | 'RETIRO_CAPITAL'>,
  values: CashMovementFormValues,
  requestId: string,
) {
  // PostgREST acepta NUMERIC como texto; así nunca convertimos dinero a float en JavaScript.
  const args = {
    p_tipo: type,
    p_monto: moneyToDatabase(values.monto),
    p_medio: values.medio,
    p_nota: values.nota.trim() || null,
    p_solicitud_id: requestId,
  };
  const { data, error } = await client().rpc('registrar_movimiento_caja', args as never);
  if (error) throw error;
  return data;
}

export async function reverseCashMovement(movementId: string, reason: string, requestId: string) {
  const { data, error } = await client().rpc('revertir_movimiento_caja', {
    p_movimiento_id: movementId,
    p_motivo: reason.trim(),
    p_solicitud_id: requestId,
  });
  if (error) throw error;
  return data;
}
