import { z } from 'zod';

const moneyPattern = /^\d{1,12}([.,]\d{1,2})?$/;

export const cashMovementSchema = z.object({
  monto: z.string()
    .trim()
    .min(1, 'Ingresa un monto.')
    .regex(moneyPattern, 'Usa un monto válido con máximo dos decimales.')
    .refine((value) => moneyToDatabase(value) !== '0.00', 'El monto debe ser mayor que cero.'),
  medio: z.enum(['EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'OTRO']),
  nota: z.string().trim().max(500, 'La nota admite hasta 500 caracteres.'),
});

export const reversalSchema = z.object({
  motivo: z.string().trim().min(3, 'Describe brevemente el motivo.').max(500),
});

export type CashMovementFormValues = z.infer<typeof cashMovementSchema>;
export type ReversalFormValues = z.infer<typeof reversalSchema>;

export function moneyToDatabase(value: string) {
  const [whole = '0', decimals = ''] = value.trim().replace(',', '.').split('.');
  const cents = decimals.padEnd(2, '0').slice(0, 2);
  return `${BigInt(whole || '0').toString()}.${cents}`;
}

