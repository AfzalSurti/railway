import { z } from 'zod';

// Deliberately no cardNumber / expiry / cvv fields anywhere in this schema —
// the API must never accept them, so there is nothing to strip or forget.
export const createPaymentMethodSchema = z.object({
  label: z.string().trim().min(1, 'label is required').max(60),
  brand: z.string().trim().min(1, 'brand is required').max(20),
  last4: z
    .string()
    .trim()
    .regex(/^\d{4}$/, 'last4 must be exactly 4 digits'),
  autoPay: z.boolean().optional(),
});

export const setAutoPaySchema = z.object({
  autoPay: z.boolean(),
});

export type CreatePaymentMethodInput = z.infer<typeof createPaymentMethodSchema>;
export type SetAutoPayInput = z.infer<typeof setAutoPaySchema>;
