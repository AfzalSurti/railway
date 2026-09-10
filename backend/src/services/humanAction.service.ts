import { HumanActionRequest, HumanActionStatus, HumanActionType, Prisma } from '@prisma/client';
import { env } from '../config/env';
import { humanActionRepository } from '../repositories/humanAction.repository';
import { bookingRepository } from '../repositories/booking.repository';
import { executionLogRepository } from '../repositories/executionLog.repository';
import { auditService } from '../observability/audit.service';
import { incr } from '../observability/metrics';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';

export type HumanActionView = {
  id: string;
  bookingTaskId: string;
  type: HumanActionType;
  status: HumanActionStatus;
  message: string;
  createdAt: string;
  resolvedAt: string | null;
  expiresAt: string;
};

function toView(action: HumanActionRequest): HumanActionView {
  return {
    id: action.id,
    bookingTaskId: action.bookingTaskId,
    type: action.type,
    status: action.status,
    message: action.message,
    createdAt: action.createdAt.toISOString(),
    resolvedAt: action.resolvedAt?.toISOString() ?? null,
    expiresAt: action.expiresAt.toISOString(),
  };
}

const ACTION_TYPE_BY_NAME: Record<string, HumanActionType> = {
  LOGIN: HumanActionType.LOGIN,
  OTP: HumanActionType.OTP,
  CAPTCHA: HumanActionType.CAPTCHA,
  PAYMENT: HumanActionType.PAYMENT,
  CONFIRMATION: HumanActionType.CONFIRMATION,
  MANUAL_REVIEW: HumanActionType.MANUAL_REVIEW,
};

export function toHumanActionType(name: string | null | undefined): HumanActionType {
  return ACTION_TYPE_BY_NAME[String(name ?? '').toUpperCase()] ?? HumanActionType.MANUAL_REVIEW;
}

async function requireOwnedBooking(userId: string, bookingId: string) {
  const booking = await bookingRepository.findById(bookingId);
  if (!booking || booking.userId !== userId) {
    throw AppError.notFound('Booking task not found');
  }
  return booking;
}

export const humanActionService = {
  /**
   * Called by the execution engine when a provider reports that a human must
   * act. Any earlier still-pending request for the booking is superseded so a
   * booking never accumulates duplicate open requests across attempts.
   */
  async createForBooking(input: {
    bookingTaskId: string;
    type: HumanActionType;
    message: string;
    metadata?: Prisma.InputJsonValue;
  }): Promise<HumanActionRequest> {
    await humanActionRepository.closePendingForBooking(
      input.bookingTaskId,
      HumanActionStatus.CANCELLED,
    );
    const expiresAt = new Date(Date.now() + env.HUMAN_ACTION_TTL_MS);
    const action = await humanActionRepository.create({
      bookingTaskId: input.bookingTaskId,
      type: input.type,
      message: input.message,
      expiresAt,
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
    });
    await executionLogRepository.create({
      bookingTaskId: input.bookingTaskId,
      step: 'HUMAN_ACTION_CREATED',
      status: 'WARNING',
      message: `Human action required: ${input.type}`,
      metadata: { humanActionId: action.id, type: input.type },
    });
    logger.info('Human action created', {
      service: 'executor',
      bookingTaskId: input.bookingTaskId,
      event: 'HUMAN_ACTION_CREATED',
      type: input.type,
    });
    incr('human_action_created_total');
    await auditService.record({
      action: 'HUMAN_ACTION_CREATED',
      bookingTaskId: input.bookingTaskId,
      result: input.type,
    });
    return action;
  },

  async listForBooking(userId: string, bookingId: string): Promise<HumanActionView[]> {
    await requireOwnedBooking(userId, bookingId);
    const actions = await humanActionRepository.listByBooking(bookingId);
    return actions.map(toView);
  },

  /**
   * Marks the request resolved. This only records that the human completed the
   * step (login, OTP, CAPTCHA, payment authorization, confirmation). It never
   * stores the secret value the human supplied. Resuming execution is a
   * separate, explicit step (POST /api/bookings/:id/resume).
   */
  async resolve(userId: string, bookingId: string, actionId: string): Promise<HumanActionView> {
    await requireOwnedBooking(userId, bookingId);
    const action = await humanActionRepository.findById(actionId);
    if (!action || action.bookingTaskId !== bookingId) {
      throw AppError.notFound('Human action request not found');
    }
    if (action.status !== HumanActionStatus.PENDING) {
      throw AppError.conflict(`Human action is already ${action.status}`);
    }
    const updated = await humanActionRepository.updateStatus(
      actionId,
      HumanActionStatus.RESOLVED,
      new Date(),
    );
    await executionLogRepository.create({
      bookingTaskId: bookingId,
      step: 'HUMAN_ACTION_RESOLVED',
      status: 'INFO',
      message: `Human action ${action.type} marked complete by the user`,
      metadata: { humanActionId: actionId, type: action.type },
    });
    await auditService.record({
      action: 'HUMAN_ACTION_RESOLVED',
      userId,
      bookingTaskId: bookingId,
      result: action.type,
    });
    return toView(updated);
  },

  /** Utility for a future scheduled sweep. Not wired to a timer yet. */
  expireOverdue(now?: Date): Promise<number> {
    return humanActionRepository.expireOverdue(now);
  },
};
