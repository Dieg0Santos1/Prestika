import { z } from 'zod';

import { moneyToDatabase } from '@/features/caja/schema';

const amountPattern = /^\d{1,12}([.,]\d{1,2})?$/;
const percentagePattern = /^\d{1,3}([.,]\d{1,4})?$/;

export const renewalFormSchema = z.object({
  montoBase: z.string().trim().regex(amountPattern, 'Ingresa un monto válido con máximo dos decimales.').refine((value) => moneyToDatabase(value) !== '0.00', 'El monto debe ser mayor que cero.'),
  porcentajeInteres: z.string().trim().regex(percentagePattern, 'Usa un porcentaje válido con máximo cuatro decimales.'),
  numeroCuotas: z.number().int().min(1).max(60),
  medioDesembolso: z.enum(['EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'OTRO']),
  nota: z.string().trim().max(500).refine((value) => value.length === 0 || value.length >= 3, 'La nota debe tener al menos 3 caracteres.'),
});

export type RenewalFormValues = z.infer<typeof renewalFormSchema>;
