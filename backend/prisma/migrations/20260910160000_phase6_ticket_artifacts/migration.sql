-- Phase 6: ticket artifacts. Metadata in Postgres, bytes behind a storage
-- abstraction. Clients only ever see an opaque id, never a filesystem path.

CREATE TABLE "TicketArtifact" (
    "id" TEXT NOT NULL,
    "bookingTaskId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketArtifact_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TicketArtifact_storageKey_key" ON "TicketArtifact"("storageKey");
CREATE INDEX "TicketArtifact_bookingTaskId_idx" ON "TicketArtifact"("bookingTaskId");
ALTER TABLE "TicketArtifact" ADD CONSTRAINT "TicketArtifact_bookingTaskId_fkey"
    FOREIGN KEY ("bookingTaskId") REFERENCES "BookingTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
