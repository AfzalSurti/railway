import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { sanitizeExecutionMetadata } from '../utils/sanitize';

export const AUDIT_ACTIONS = [
  'BOOKING_CREATED',
  'BOOKING_SCHEDULED',
  'BOOKING_RESCHEDULED',
  'BOOKING_CANCELLED',
  'BOOKING_DELETED',
  'BOOKING_RUN_NOW',
  'BOOKING_RESUMED',
  'BOOKING_STARTED',
  'AUTH_REQUIRED',
  'PAYMENT_REQUIRED',
  'PAYMENT_COMPLETED',
  'PAYMENT_FAILED',
  'BOOKING_COMPLETED',
  'BOOKING_FAILED',
  'UNKNOWN_RESULT',
  'HUMAN_ACTION_CREATED',
  'HUMAN_ACTION_RESOLVED',
  'TICKET_STORED',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditInput = {
  action: AuditAction;
  userId?: string | null;
  bookingTaskId?: string | null;
  provider?: string | null;
  result?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Append-only audit trail. Best-effort: a failed audit write is logged but
 * never propagates, so auditing can never break a user action. Metadata is run
 * through the same redaction as execution-log metadata.
 */
export const auditService = {
  async record(input: AuditInput): Promise<void> {
    try {
      const metadata = input.metadata
        ? (sanitizeExecutionMetadata(input.metadata) as Prisma.InputJsonValue)
        : undefined;
      await prisma.auditEvent.create({
        data: {
          action: input.action,
          userId: input.userId ?? null,
          bookingTaskId: input.bookingTaskId ?? null,
          provider: input.provider ?? null,
          result: input.result ?? null,
          ...(metadata !== undefined ? { metadata } : {}),
        },
      });
    } catch (error) {
      logger.warn('Audit write failed', {
        service: 'api',
        event: 'AUDIT_WRITE_FAILED',
        message: error instanceof Error ? error.message : 'unknown',
        auditAction: input.action,
      });
    }
  },

  listForBooking(bookingTaskId: string) {
    return prisma.auditEvent.findMany({
      where: { bookingTaskId },
      orderBy: { createdAt: 'asc' },
    });
  },
};
