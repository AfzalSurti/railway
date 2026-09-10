-- Phase 6: append-only audit trail. No foreign keys so events outlive the
-- rows they reference. Never stores secrets.

CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "bookingTaskId" TEXT,
    "action" TEXT NOT NULL,
    "provider" TEXT,
    "result" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditEvent_bookingTaskId_idx" ON "AuditEvent"("bookingTaskId");
CREATE INDEX "AuditEvent_userId_idx" ON "AuditEvent"("userId");
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");
