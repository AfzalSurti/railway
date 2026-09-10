import { ServiceType } from '@prisma/client';
import { z } from 'zod';

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'journeyDate must be a valid date (YYYY-MM-DD)')
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'journeyDate must be a valid date' });

const dateTime = z
  .string()
  .min(1, 'scheduledAt is required')
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'scheduledAt must be a valid date' });

export const createBookingSchema = z.object({
  serviceType: z.nativeEnum(ServiceType),
  provider: z.string().trim().min(1, 'provider is required').max(80),
  source: z.string().trim().min(1, 'source is required').max(80),
  destination: z.string().trim().min(1, 'destination is required').max(80),
  journeyDate: dateOnly,
  scheduledAt: dateTime,
  trainNumber: z.string().trim().max(40).optional(),
  travelClass: z.string().trim().max(40).optional(),
  quota: z.string().trim().max(40).optional(),
  passengerIds: z.array(z.string().uuid()).min(1, 'passengerIds must contain at least one passenger'),
});

export const updateBookingSchema = z
  .object({
    serviceType: z.nativeEnum(ServiceType).optional(),
    provider: z.string().trim().min(1).max(80).optional(),
    source: z.string().trim().min(1).max(80).optional(),
    destination: z.string().trim().min(1).max(80).optional(),
    journeyDate: dateOnly.optional(),
    scheduledAt: dateTime.optional(),
    trainNumber: z.string().trim().max(40).nullable().optional(),
    travelClass: z.string().trim().max(40).nullable().optional(),
    quota: z.string().trim().max(40).nullable().optional(),
    passengerIds: z.array(z.string().uuid()).min(1).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;

export const rescheduleBookingSchema = z.object({
  scheduledAt: dateTime,
});

export const runBookingSchema = z.object({
  mockOutcome: z
    .enum([
      'SUCCESS',
      'TRAIN_NOT_FOUND',
      'NO_SEATS',
      'WEBSITE_TIMEOUT',
      'NETWORK_ERROR',
      'TEMPORARY_SERVER_ERROR',
      'PAYMENT_FAILED',
      'PAYMENT_REQUIRED',
      'AUTHENTICATION_REQUIRED',
      'OTP_REQUIRED',
      'CAPTCHA_REQUIRED',
      'PRICE_CHANGED',
      'BOOKING_REJECTED',
      'TICKET_DOWNLOAD_FAILED',
      'UNKNOWN_ERROR',
      'UNKNOWN_RESULT',
      'UNKNOWN_RESULT_RECONCILE_CONFIRMED',
      'UNKNOWN_RESULT_RECONCILE_FAILED',
    ])
    .optional(),
});
