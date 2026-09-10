import { TicketArtifact } from '@prisma/client';
import { prisma } from '../config/database';

export const ticketRepository = {
  create(data: {
    bookingTaskId: string;
    provider: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
  }): Promise<TicketArtifact> {
    return prisma.ticketArtifact.create({ data });
  },

  findById(id: string): Promise<TicketArtifact | null> {
    return prisma.ticketArtifact.findUnique({ where: { id } });
  },

  listByBooking(bookingTaskId: string): Promise<TicketArtifact[]> {
    return prisma.ticketArtifact.findMany({
      where: { bookingTaskId },
      orderBy: { createdAt: 'desc' },
    });
  },
};
