import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/database';

export type ActivityCategory = 'CAJA' | 'PRESTAMO' | 'COBRO' | 'RENOVACION' | 'CIERRE';
export type ActivityType =
  | 'CAPITAL_INICIAL'
  | 'APORTE_CAPITAL'
  | 'RETIRO_CAPITAL'
  | 'REVERSO_CAJA'
  | 'PRESTAMO_CREADO'
  | 'RENOVACION'
  | 'PAGO_RECIBIDO'
  | 'PAGO_REVERTIDO'
  | 'PRESTAMO_INCOBRABLE'
  | 'PRESTAMO_ANULADO';

export type ActivityEvent = {
  id: string;
  tipo: ActivityType;
  categoria: ActivityCategory;
  monto: string;
  direccion: 1 | 0 | -1;
  medio: string;
  nota: string | null;
  ocurrido_at: string;
  cliente_id: string | null;
  cliente_nombre: string | null;
  prestamo_id: string | null;
  monto_base: string | null;
  monto_interes: string | null;
  total_a_cobrar: string | null;
  monto_desembolsado: string | null;
  saldo_compensado: string | null;
  esta_revertido: boolean;
};

export type ActivitySummary = { cantidad: number; eventos: ActivityEvent[] };

function client() {
  if (!supabase) throw new Error('Supabase no está configurado.');
  return supabase;
}

function objectValue(value: Json): Record<string, Json | undefined> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Supabase devolvió una actividad inválida.');
  return value;
}

function textValue(value: Json | undefined, fallback = '') { return typeof value === 'string' ? value : fallback; }
function nullableText(value: Json | undefined) { return typeof value === 'string' ? value : null; }

export async function getActivity(): Promise<ActivitySummary> {
  const { data, error } = await client().rpc('obtener_actividad', { p_limite: 300 });
  if (error) throw error;
  const result = objectValue(data);
  const rawEvents = Array.isArray(result.eventos) ? result.eventos : [];

  return {
    cantidad: typeof result.cantidad === 'number' ? result.cantidad : 0,
    eventos: rawEvents.map((raw) => {
      const event = objectValue(raw);
      return {
        id: textValue(event.id),
        tipo: textValue(event.tipo) as ActivityType,
        categoria: textValue(event.categoria) as ActivityCategory,
        monto: textValue(event.monto, '0.00'),
        direccion: event.direccion === -1 ? -1 : event.direccion === 0 ? 0 : 1,
        medio: textValue(event.medio),
        nota: nullableText(event.nota),
        ocurrido_at: textValue(event.ocurrido_at),
        cliente_id: nullableText(event.cliente_id),
        cliente_nombre: nullableText(event.cliente_nombre),
        prestamo_id: nullableText(event.prestamo_id),
        monto_base: nullableText(event.monto_base),
        monto_interes: nullableText(event.monto_interes),
        total_a_cobrar: nullableText(event.total_a_cobrar),
        monto_desembolsado: nullableText(event.monto_desembolsado),
        saldo_compensado: nullableText(event.saldo_compensado),
        esta_revertido: event.esta_revertido === true,
      };
    }),
  };
}
