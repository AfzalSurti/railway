import { TicketArtifact } from '@prisma/client';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { bookingRepository } from '../repositories/booking.repository';
import { executionLogRepository } from '../repositories/executionLog.repository';
import { ticketRepository } from '../repositories/ticket.repository';
import { fileStorage } from '../storage/file-storage';
import { TicketDownloadResult } from '../providers/provider.types';

const ALLOWED_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
};

export type TicketView = {
  id: string;
  bookingTaskId: string;
  provider: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

function toView(ticket: TicketArtifact): TicketView {
  return {
    id: ticket.id,
    bookingTaskId: ticket.bookingTaskId,
    provider: ticket.provider,
    fileName: ticket.fileName,
    mimeType: ticket.mimeType,
    sizeBytes: ticket.sizeBytes,
    createdAt: ticket.createdAt.toISOString(),
  };
}

async function requireOwnedBooking(userId: string, bookingId: string) {
  const booking = await bookingRepository.findById(bookingId);
  if (!booking || booking.userId !== userId) {
    throw AppError.notFound('Booking task not found');
  }
  return booking;
}

function safeFileName(name: string, extension: string): string {
  const base = name.replace(/[^a-z0-9._-]/gi, '_').slice(0, 120) || 'ticket';
  return base.toLowerCase().endsWith(`.${extension}`) ? base : `${base}.${extension}`;
}

export const ticketService = {
  /**
   * Persists a ticket produced by a provider. Validates mime type and size,
   * writes the bytes through the storage abstraction, and records metadata.
   * Never throws for a caller that already has a confirmed booking — it returns
   * null on any problem so ticket retrieval failure cannot fail the booking.
   */
  async storeTicket(
    bookingTaskId: string,
    provider: string,
    download: TicketDownloadResult,
  ): Promise<TicketArtifact | null> {
    try {
      const extension = ALLOWED_MIME[download.mimeType];
      if (!extension) {
        throw new Error(`Unsupported ticket mime type: ${download.mimeType}`);
      }
      const bytes = Buffer.from(download.contentBase64, 'base64');
      if (bytes.length === 0 || bytes.length > env.TICKET_MAX_BYTES) {
        throw new Error(`Ticket size ${bytes.length} is outside the allowed range`);
      }
      const storageKey = await fileStorage.put(bytes, extension);
      const ticket = await ticketRepository.create({
        bookingTaskId,
        provider: provider.toUpperCase(),
        fileName: safeFileName(download.fileName, extension),
        mimeType: download.mimeType,
        sizeBytes: bytes.length,
        storageKey,
      });
      await executionLogRepository.create({
        bookingTaskId,
        step: 'TICKET_STORED',
        status: 'SUCCESS',
        message: 'Ticket retrieved and stored',
        metadata: { ticketArtifactId: ticket.id, sizeBytes: bytes.length },
      });
      return ticket;
    } catch (error) {
      logger.warn('Ticket storage failed', {
        service: 'executor',
        bookingTaskId,
        event: 'TICKET_STORE_FAILED',
        message: error instanceof Error ? error.message : 'unknown',
      });
      await executionLogRepository
        .create({
          bookingTaskId,
          step: 'TICKET_STORE_FAILED',
          status: 'WARNING',
          message: 'Ticket could not be stored. The booking is still confirmed.',
        })
        .catch(() => undefined);
      return null;
    }
  },

  async listForBooking(userId: string, bookingId: string): Promise<TicketView[]> {
    await requireOwnedBooking(userId, bookingId);
    const rows = await ticketRepository.listByBooking(bookingId);
    return rows.map(toView);
  },

  async download(
    userId: string,
    bookingId: string,
    ticketId: string,
  ): Promise<{ fileName: string; mimeType: string; body: Buffer }> {
    await requireOwnedBooking(userId, bookingId);
    const ticket = await ticketRepository.findById(ticketId);
    if (!ticket || ticket.bookingTaskId !== bookingId) {
      throw AppError.notFound('Ticket not found');
    }
    if (!(await fileStorage.exists(ticket.storageKey))) {
      throw AppError.notFound('Ticket file is no longer available');
    }
    const body = await fileStorage.get(ticket.storageKey);
    return { fileName: ticket.fileName, mimeType: ticket.mimeType, body };
  },
};
