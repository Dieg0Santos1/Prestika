import { moneyToDatabase } from '@/features/caja/schema';
import { percentageToDatabase } from '@/features/prestamos/schema';
import { supabase } from '@/lib/supabase';

import type { RenewalFormValues } from './schema';

export async function renewLoan(previousLoanId: string, values: RenewalFormValues, requestId: string) {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { data, error } = await supabase.rpc('renovar_prestamo', {
    p_prestamo_anterior_id: previousLoanId,
    p_nuevo_monto_base: moneyToDatabase(values.montoBase),
    p_porcentaje_interes: percentageToDatabase(values.porcentajeInteres),
    p_numero_cuotas: values.numeroCuotas,
    p_medio_desembolso: values.medioDesembolso,
    p_nota: values.nota.trim() || null,
    p_solicitud_id: requestId,
  } as never);
  if (error) throw error;
  return data;
}
