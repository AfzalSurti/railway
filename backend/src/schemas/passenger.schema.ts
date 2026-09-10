import { Gender } from '@prisma/client';
import { z } from 'zod';

export const createPassengerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  age: z.coerce.number().int().min(1).max(120),
  gender: z.nativeEnum(Gender),
  phone: z.string().trim().min(8).max(20),
});

export const updatePassengerSchema = createPassengerSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'At least one field is required' },
);

export type CreatePassengerInput = z.infer<typeof createPassengerSchema>;
export type UpdatePassengerInput = z.infer<typeof updatePassengerSchema>;
