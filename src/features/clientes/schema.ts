import { z } from 'zod';

export const clientFormSchema = z.object({
  nombres: z.string().trim().min(2, 'Ingresa al menos 2 caracteres.').max(100),
  apellidos: z.string().trim().max(100).refine((value) => value.length === 0 || value.length >= 2, 'Ingresa al menos 2 caracteres.'),
  celular: z.string().trim().refine((value) => value.length === 0 || value.length >= 6, 'Ingresa al menos 6 caracteres.'),
  metodoPago: z.enum(['', 'EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'OTRO']),
  numeroYapePlin: z.string().trim().max(20),
  observaciones: z.string().trim().max(500),
});

export type ClientFormValues = z.infer<typeof clientFormSchema>;
