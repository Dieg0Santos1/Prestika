import { z } from 'zod';

import { moneyToDatabase } from '@/features/caja/schema';

const amountPattern = /^\d{1,12}([.,]\d{1,2})?$/;

export const paymentFormSchema = z.object({
  monto: z.string().trim().regex(amountPattern, 'Ingresa un monto válido con máximo dos decimales.').refine((value) => moneyToDatabase(value) !== '0.00', 'El pago debe ser mayor que cero.'),
  medio: z.enum(['EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'OTRO']),
  nota: z.string().trim().max(500, 'La nota admite hasta 500 caracteres.').refine((value) => value.length === 0 || value.length >= 3, 'La nota debe tener al menos 3 caracteres.'),
});

export type PaymentFormValues = z.infer<typeof paymentFormSchema>;

export function compareMoneyText(left: string, right: string) {
  return toCents(left) - toCents(right);
}

export function subtractMoneyText(left: string, right: string) {
  return centsToText(toCents(left) - toCents(right));
}

function toCents(value: string) {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return 0n;
  const [whole, decimals = ''] = normalized.split('.');
  return BigInt(whole) * 100n + BigInt(decimals.padEnd(2, '0'));
}

function centsToText(cents: bigint) {
  const safe = cents < 0n ? 0n : cents;
  return `${safe / 100n}.${(safe % 100n).toString().padStart(2, '0')}`;
}
