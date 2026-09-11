import { z } from 'zod';

import { moneyToDatabase } from '@/features/caja/schema';

const amountPattern = /^\d{1,12}([.,]\d{1,2})?$/;
const percentagePattern = /^\d{1,3}([.,]\d{1,4})?$/;

export const loanFormSchema = z.object({
  clienteId: z.string().uuid('Selecciona un cliente.'),
  montoBase: z.string().trim().regex(amountPattern, 'Ingresa un monto válido con máximo dos decimales.').refine((value) => moneyToDatabase(value) !== '0.00', 'El monto debe ser mayor que cero.'),
  porcentajeInteres: z.string().trim().regex(percentagePattern, 'Usa un porcentaje válido con máximo cuatro decimales.'),
  numeroCuotas: z.number().int().min(1).max(60),
  medioDesembolso: z.enum(['EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'OTRO']),
  nota: z.string().trim().max(500).refine((value) => value.length === 0 || value.length >= 3, 'La nota debe tener al menos 3 caracteres.'),
});

export type LoanFormValues = z.infer<typeof loanFormSchema>;

function decimalToUnits(value: string, scale: number) {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  return BigInt(whole) * (10n ** BigInt(scale)) + BigInt(fraction.padEnd(scale, '0').slice(0, scale));
}

function centsToText(cents: bigint) {
  const whole = cents / 100n;
  const fraction = (cents % 100n).toString().padStart(2, '0');
  return `${whole}.${fraction}`;
}

export function calculateLoanPreview(amount: string, percentage: string, installments: number) {
  const amountCents = decimalToUnits(amount, 2);
  const percentageUnits = decimalToUnits(percentage, 4);
  if (amountCents === null || percentageUnits === null || amountCents <= 0n || installments < 1) return null;

  const divisor = 1_000_000n; // 100% expresado con cuatro decimales.
  const interestCents = (amountCents * percentageUnits + divisor / 2n) / divisor;
  const totalCents = amountCents + interestCents;
  const installmentCount = BigInt(installments);
  const baseInstallment = totalCents / installmentCount;
  const remainder = totalCents % installmentCount;

  return {
    amount: centsToText(amountCents),
    interest: centsToText(interestCents),
    total: centsToText(totalCents),
    firstInstallment: centsToText(baseInstallment + (remainder > 0n ? 1n : 0n)),
    lastInstallment: centsToText(baseInstallment),
    hasRoundingDifference: remainder > 0n,
  };
}

export function percentageToDatabase(value: string) {
  const normalized = value.trim().replace(',', '.');
  const [whole = '0', decimals = ''] = normalized.split('.');
  return `${BigInt(whole || '0').toString()}.${decimals.padEnd(4, '0').slice(0, 4)}`;
}
