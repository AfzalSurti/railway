import { Request, Response } from 'express';
import { bookingService } from '../services/booking.service';
import { humanActionService } from '../services/humanAction.service';
import { paymentService } from '../services/payment.service';
import { ticketService } from '../services/ticket.service';
import { auditService } from '../observability/audit.service';
import { bookingAttemptRepository } from '../repositories/bookingAttempt.repository';
import { sendSuccess } from '../utils/apiResponse';
import { getAuthenticatedUserId } from '../middleware/requireAuth';
import { CreateBookingInput, UpdateBookingInput } from '../schemas/booking.schema';
import { MockExecutorOutcome } from '../config/env';
import { sanitizeExecutionMetadata } from '../utils/sanitize';

function bookingPayload(booking: Awaited<ReturnType<typeof bookingService.create>>) {
  return {
    id: booking.id,
    serviceType: booking.serviceType,
    provider: booking.provider,
    source: booking.source,
    destination: booking.destination,
    journeyDate: booking.journeyDate,
    scheduledAt: booking.scheduledAt,
    trainNumber: booking.trainNumber,
    travelClass: booking.travelClass,
    quota: booking.quota,
    status: booking.status,
    startedAt: booking.startedAt,
    completedAt: booking.completedAt,
    failedAt: booking.failedAt,
    retryCount: booking.retryCount,
    failureCode: booking.failureCode,
    failureReason: booking.failureReason,
    lastAttemptAt: booking.lastAttemptAt,
    bookingReference: booking.bookingReference,
    cancellationRequested: booking.cancellationRequested,
    actionRequired: booking.actionRequired,
    actionRequiredType: booking.actionRequiredType,
    actionRequiredMessage: booking.actionRequiredMessage,
    currentStage: booking.currentStage,
    providerStatus: booking.providerStatus,
    artifactId: booking.artifactId,
    passengers: booking.passengers,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  };
}

export const bookingController = {
  async create(req: Request, res: Response): Promise<void> {
    const booking = await bookingService.create(
      getAuthenticatedUserId(req),
      req.body as CreateBookingInput,
    );
    sendSuccess(res, bookingPayload(booking), 'Booking task scheduled', 201);
  },

  async list(req: Request, res: Response): Promise<void> {
    const bookings = await bookingService.list(getAuthenticatedUserId(req));
    sendSuccess(res, bookings.map(bookingPayload));
  },

  async getById(req: Request, res: Response): Promise<void> {
    const booking = await bookingService.getById(getAuthenticatedUserId(req), req.params.id);
    sendSuccess(res, bookingPayload(booking));
  },

  async update(req: Request, res: Response): Promise<void> {
    const booking = await bookingService.update(
      getAuthenticatedUserId(req),
      req.params.id,
      req.body as UpdateBookingInput,
    );
    sendSuccess(res, bookingPayload(booking), 'Booking task updated');
  },

  async remove(req: Request, res: Response): Promise<void> {
    await bookingService.remove(getAuthenticatedUserId(req), req.params.id);
    sendSuccess(res, null, 'Booking task deleted');
  },

  async cancel(req: Request, res: Response): Promise<void> {
    const booking = await bookingService.cancel(getAuthenticatedUserId(req), req.params.id);
    sendSuccess(res, bookingPayload(booking), 'Booking task cancelled');
  },

  async reschedule(req: Request, res: Response): Promise<void> {
    const booking = await bookingService.reschedule(
      getAuthenticatedUserId(req),
      req.params.id,
      (req.body as { scheduledAt: string }).scheduledAt,
    );
    sendSuccess(res, bookingPayload(booking), 'Booking task rescheduled');
  },

  async runNow(req: Request, res: Response): Promise<void> {
    const booking = await bookingService.runNow(
      getAuthenticatedUserId(req),
      req.params.id,
      (req.body as { mockOutcome?: MockExecutorOutcome }).mockOutcome,
    );
    sendSuccess(res, bookingPayload(booking), 'Booking queued for immediate execution');
  },

  async resume(req: Request, res: Response): Promise<void> {
    const booking = await bookingService.resume(getAuthenticatedUserId(req), req.params.id);
    sendSuccess(res, bookingPayload(booking), 'Booking queued to resume after human action');
  },

  async listActions(req: Request, res: Response): Promise<void> {
    const actions = await humanActionService.listForBooking(getAuthenticatedUserId(req), req.params.id);
    sendSuccess(res, actions);
  },

  async resolveAction(req: Request, res: Response): Promise<void> {
    const action = await humanActionService.resolve(
      getAuthenticatedUserId(req),
      req.params.id,
      req.params.actionId,
    );
    sendSuccess(res, action, 'Human action marked complete');
  },

  async listPayments(req: Request, res: Response): Promise<void> {
    const payments = await paymentService.listForBooking(getAuthenticatedUserId(req), req.params.id);
    sendSuccess(res, payments);
  },

  async authorizePayment(req: Request, res: Response): Promise<void> {
    const payment = await paymentService.authorize(getAuthenticatedUserId(req), req.params.id);
    sendSuccess(res, payment, 'Payment authorization recorded');
  },

  async listTickets(req: Request, res: Response): Promise<void> {
    const tickets = await ticketService.listForBooking(getAuthenticatedUserId(req), req.params.id);
    sendSuccess(res, tickets);
  },

  async downloadTicket(req: Request, res: Response): Promise<void> {
    const ticket = await ticketService.download(
      getAuthenticatedUserId(req),
      req.params.id,
      req.params.ticketId,
    );
    res.setHeader('Content-Type', ticket.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${ticket.fileName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(ticket.body);
  },

  async attempts(req: Request, res: Response): Promise<void> {
    await bookingService.getById(getAuthenticatedUserId(req), req.params.id);
    const rows = await bookingAttemptRepository.listByBooking(req.params.id);
    sendSuccess(
      res,
      rows.map((attempt) => ({
        id: attempt.id,
        attemptNumber: attempt.attemptNumber,
        status: attempt.status,
        startedAt: attempt.startedAt,
        endedAt: attempt.endedAt,
        failureCode: attempt.failureCode,
        failureReason: attempt.failureReason,
      })),
    );
  },

  async audit(req: Request, res: Response): Promise<void> {
    await bookingService.getById(getAuthenticatedUserId(req), req.params.id);
    const events = await auditService.listForBooking(req.params.id);
    sendSuccess(
      res,
      events.map((event) => ({
        id: event.id,
        action: event.action,
        provider: event.provider,
        result: event.result,
        createdAt: event.createdAt,
      })),
    );
  },

  async logs(req: Request, res: Response): Promise<void> {
    const logs = await bookingService.getLogs(getAuthenticatedUserId(req), req.params.id);
    sendSuccess(
      res,
      logs.map((log) => ({
        id: log.id,
        step: log.step,
        status: log.status,
        message: log.message,
        metadata: sanitizeExecutionMetadata(log.metadata),
        createdAt: log.createdAt,
      })),
    );
  },
};
