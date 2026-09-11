import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/database';
import { moneyToDatabase } from '@/features/caja/schema';
import { percentageToDatabase, type LoanFormValues } from './schema';

export type LoanInstallment = {
  id: string;
  numero: number;
  monto_programado: string;
  monto_actual: string;
  monto_pagado: string;
  saldo_pendiente: string;
  monto_recibido_traslado: string;
  monto_enviado_traslado: string;
  estado: 'PENDIENTE' | 'PARCIAL' | 'PAGADA';
};
export type LoanPayment = {
  id: string;
  tipo: 'PAGO' | 'COMPENSACION_RENOVACION' | 'REVERSO';
  monto: string;
  direccion: 1 | -1;
  monto_capital: string;
  monto_interes: string;
  medio: string;
  nota: string | null;
  pago_revertido_id: string | null;
  esta_revertido: boolean;
  ocurrido_at: string;
  cuotas: number[];
  monto_trasladado: string;
};
export type Loan = {
  id: string;
  cliente_id: string;
  cliente_nombre: string;
  tipo: 'NORMAL' | 'RENOVACION';
  monto_base: string;
  porcentaje_interes: string;
  monto_interes: string;
  total_a_cobrar: string;
  monto_desembolsado: string;
  saldo_compensado: string;
  total_pagado: string;
  capital_pagado: string;
  interes_pagado: string;
  saldo_pendiente: string;
  numero_cuotas: number;
  medio_desembolso: string;
  estado: 'ACTIVO' | 'PAGADO' | 'RENOVADO' | 'INCOBRABLE' | 'ANULADO';
  prestamo_origen_id: string | null;
  nota: string | null;
  fecha_prestamo: string;
  cuotas: LoanInstallment[];
  pagos: LoanPayment[];
};

export type LoansSummary = { cantidad: number; activos: number; por_cobrar: string; total_cobrado: string; ganancia_consolidada: string; prestamos: Loan[] };

export type LoanClosureType = 'INCOBRABLE' | 'ANULACION';
export type LoanClosure = {
  id: string;
  tipo: LoanClosureType;
  saldo_afectado: string;
  monto_caja_revertido: string;
  motivo: string;
  ocurrido_at: string;
};

function client() {
  if (!supabase) throw new Error('Supabase no está configurado.');
  return supabase;
}

function objectValue(value: Json): Record<string, Json | undefined> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Supabase devolvió datos de préstamos inválidos.');
  return value;
}

function textValue(value: Json | undefined, fallback = '0.00') { return typeof value === 'string' ? value : fallback; }
function numberValue(value: Json | undefined) { return typeof value === 'number' ? value : 0; }

function parseLoan(value: Json): Loan {
  const item = objectValue(value);
  const rawInstallments = Array.isArray(item.cuotas) ? item.cuotas : [];
  return {
    id: textValue(item.id, ''), cliente_id: textValue(item.cliente_id, ''), cliente_nombre: textValue(item.cliente_nombre, ''),
    tipo: textValue(item.tipo, 'NORMAL') as Loan['tipo'], monto_base: textValue(item.monto_base), porcentaje_interes: textValue(item.porcentaje_interes),
    monto_interes: textValue(item.monto_interes), total_a_cobrar: textValue(item.total_a_cobrar), monto_desembolsado: textValue(item.monto_desembolsado),
    saldo_compensado: textValue(item.saldo_compensado), total_pagado: textValue(item.total_pagado), capital_pagado: textValue(item.capital_pagado),
    interes_pagado: textValue(item.interes_pagado), saldo_pendiente: textValue(item.saldo_pendiente), numero_cuotas: numberValue(item.numero_cuotas),
    medio_desembolso: textValue(item.medio_desembolso), estado: textValue(item.estado, 'ACTIVO') as Loan['estado'],
    prestamo_origen_id: typeof item.prestamo_origen_id === 'string' ? item.prestamo_origen_id : null,
    nota: typeof item.nota === 'string' ? item.nota : null, fecha_prestamo: textValue(item.fecha_prestamo),
    cuotas: rawInstallments.map((raw) => { const installment = objectValue(raw); return {
      id: textValue(installment.id, ''), numero: numberValue(installment.numero), monto_programado: textValue(installment.monto_programado),
      monto_actual: textValue(installment.monto_actual), monto_pagado: textValue(installment.monto_pagado), saldo_pendiente: textValue(installment.saldo_pendiente),
      monto_recibido_traslado: textValue(installment.monto_recibido_traslado), monto_enviado_traslado: textValue(installment.monto_enviado_traslado),
      estado: textValue(installment.estado, 'PENDIENTE') as LoanInstallment['estado'],
    }; }),
    pagos: (Array.isArray(item.pagos) ? item.pagos : []).map((raw) => { const payment = objectValue(raw); return {
      id: textValue(payment.id, ''), tipo: textValue(payment.tipo, 'PAGO') as LoanPayment['tipo'], monto: textValue(payment.monto),
      direccion: payment.direccion === -1 ? -1 : 1, monto_capital: textValue(payment.monto_capital), monto_interes: textValue(payment.monto_interes),
      medio: textValue(payment.medio), nota: typeof payment.nota === 'string' ? payment.nota : null,
      pago_revertido_id: typeof payment.pago_revertido_id === 'string' ? payment.pago_revertido_id : null, esta_revertido: payment.esta_revertido === true,
      ocurrido_at: textValue(payment.ocurrido_at), cuotas: (Array.isArray(payment.cuotas) ? payment.cuotas : []).map(numberValue), monto_trasladado: textValue(payment.monto_trasladado),
    }; }),
  };
}

export async function getLoansSummary(clientId?: string): Promise<LoansSummary> {
  const { data, error } = await client().rpc('obtener_prestamos', { p_cliente_id: clientId });
  if (error) throw error;
  const summary = objectValue(data);
  const rawLoans = Array.isArray(summary.prestamos) ? summary.prestamos : [];
  return {
    cantidad: numberValue(summary.cantidad), activos: numberValue(summary.activos), por_cobrar: textValue(summary.por_cobrar),
    total_cobrado: textValue(summary.total_cobrado), ganancia_consolidada: textValue(summary.ganancia_consolidada), prestamos: rawLoans.map(parseLoan),
  };
}

export async function createLoan(values: LoanFormValues, requestId: string) {
  const args = {
    p_cliente_id: values.clienteId,
    p_monto_base: moneyToDatabase(values.montoBase),
    p_porcentaje_interes: percentageToDatabase(values.porcentajeInteres),
    p_numero_cuotas: values.numeroCuotas,
    p_medio_desembolso: values.medioDesembolso,
    p_nota: values.nota.trim() || null,
    p_solicitud_id: requestId,
  };
  const { data, error } = await client().rpc('crear_prestamo', args as never);
  if (error) throw error;
  return data;
}

export async function registerPayment(args: { prestamoId: string; monto: string; medio: string; nota: string; trasladarRestante: boolean; pagoTotal: boolean; requestId: string }) {
  const { data, error } = await client().rpc('registrar_pago', {
    p_prestamo_id: args.prestamoId,
    p_monto: moneyToDatabase(args.monto),
    p_medio: args.medio,
    p_nota: args.nota.trim() || null,
    p_trasladar_restante: args.trasladarRestante,
    p_pago_total: args.pagoTotal,
    p_solicitud_id: args.requestId,
  } as never);
  if (error) throw error;
  return data;
}

export async function reversePayment(paymentId: string, reason: string, requestId: string) {
  const { data, error } = await client().rpc('revertir_pago', { p_pago_id: paymentId, p_motivo: reason.trim(), p_solicitud_id: requestId });
  if (error) throw error;
  return data;
}

export async function closeLoan(loanId: string, type: LoanClosureType, reason: string, requestId: string) {
  const { data, error } = await client().rpc('cerrar_prestamo', {
    p_prestamo_id: loanId,
    p_tipo: type,
    p_motivo: reason.trim(),
    p_solicitud_id: requestId,
  });
  if (error) throw error;
  return data;
}

export async function getLoanClosure(loanId: string): Promise<LoanClosure | null> {
  const { data, error } = await client().rpc('obtener_cierre_prestamo', { p_prestamo_id: loanId });
  if (error) throw error;
  if (data === null) return null;
  const closure = objectValue(data);
  return {
    id: textValue(closure.id, ''),
    tipo: textValue(closure.tipo) as LoanClosureType,
    saldo_afectado: textValue(closure.saldo_afectado),
    monto_caja_revertido: textValue(closure.monto_caja_revertido),
    motivo: textValue(closure.motivo, ''),
    ocurrido_at: textValue(closure.ocurrido_at, ''),
  };
}
