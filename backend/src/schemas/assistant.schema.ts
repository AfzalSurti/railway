import { z } from 'zod';

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const place = z.string().trim().min(1).max(80);

export const draftSchema = z.object({
  serviceType: z.enum(['TRAIN', 'BUS', 'FLIGHT']).optional(),
  source: place.optional(),
  destination: place.optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  timeFrom: clock.optional(),
  timeTo: clock.optional(),
  anyTime: z.boolean().optional(),
  travelClass: z.string().trim().max(40).optional(),
  passengers: z.number().int().min(1).max(9).optional(),
});

export const assistantSearchSchema = z.object({
  message: z.string().trim().min(1, 'Type what you are looking for').max(500),
  draft: draftSchema.optional(),
  awaiting: z.enum(['serviceType', 'source', 'destination', 'date', 'time']).nullable().optional(),
});

export type AssistantSearchInput = z.infer<typeof assistantSearchSchema>;
