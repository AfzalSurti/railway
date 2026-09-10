-- =====================================================================
-- AI Travel Booking Agent — manual apply for Phases 4-6
-- Paste this whole file into the Neon SQL editor and Run.
--
-- Safe to run more than once (every statement is guarded).
-- It applies the same DDL as prisma/migrations/2026091013xxxx..17xxxx and
-- then records those 5 migrations in _prisma_migrations so that a later
-- `npx prisma migrate deploy` / `migrate status` sees them as applied.
--
-- After running this, locally run:  cd backend && npx prisma generate
-- =====================================================================


-- ---------------------------------------------------------------------
-- 20260910130000_phase4_provider_capabilities
-- ---------------------------------------------------------------------
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'UNKNOWN_RESULT' BEFORE 'COMPLETED';


-- ---------------------------------------------------------------------
-- 20260910140000_phase5_human_in_the_loop
-- ---------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "HumanActionType" AS ENUM ('LOGIN', 'OTP', 'CAPTCHA', 'PAYMENT', 'CONFIRMATION', 'MANUAL_REVIEW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "HumanActionStatus" AS ENUM ('PENDING', 'RESOLVED', 'EXPIRED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ProviderSessionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM ('REQUIRED', 'PROCESSING', 'SUCCESS', 'FAILED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "HumanActionRequest" (
    "id" TEXT NOT NULL,
    "bookingTaskId" TEXT NOT NULL,
    "type" "HumanActionType" NOT NULL,
    "status" "HumanActionStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HumanActionRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "HumanActionRequest_bookingTaskId_idx" ON "HumanActionRequest"("bookingTaskId");
CREATE INDEX IF NOT EXISTS "HumanActionRequest_status_idx" ON "HumanActionRequest"("status");
DO $$ BEGIN
  ALTER TABLE "HumanActionRequest" ADD CONSTRAINT "HumanActionRequest_bookingTaskId_fkey"
    FOREIGN KEY ("bookingTaskId") REFERENCES "BookingTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ProviderSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "ProviderSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "reference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProviderSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ProviderSession_userId_provider_idx" ON "ProviderSession"("userId", "provider");
CREATE INDEX IF NOT EXISTS "ProviderSession_status_idx" ON "ProviderSession"("status");
DO $$ BEGIN
  ALTER TABLE "ProviderSession" ADD CONSTRAINT "ProviderSession_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ---------------------------------------------------------------------
-- 20260910150000_phase5_payment
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "bookingTaskId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'REQUIRED',
    "providerRef" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PaymentTransaction_bookingTaskId_idx" ON "PaymentTransaction"("bookingTaskId");
CREATE INDEX IF NOT EXISTS "PaymentTransaction_status_idx" ON "PaymentTransaction"("status");
DO $$ BEGIN
  ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_bookingTaskId_fkey"
    FOREIGN KEY ("bookingTaskId") REFERENCES "BookingTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ---------------------------------------------------------------------
-- 20260910160000_phase6_ticket_artifacts
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "TicketArtifact" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "TicketArtifact_storageKey_key" ON "TicketArtifact"("storageKey");
CREATE INDEX IF NOT EXISTS "TicketArtifact_bookingTaskId_idx" ON "TicketArtifact"("bookingTaskId");
DO $$ BEGIN
  ALTER TABLE "TicketArtifact" ADD CONSTRAINT "TicketArtifact_bookingTaskId_fkey"
    FOREIGN KEY ("bookingTaskId") REFERENCES "BookingTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ---------------------------------------------------------------------
-- 20260910170000_phase6_audit_events
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "AuditEvent" (
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
CREATE INDEX IF NOT EXISTS "AuditEvent_bookingTaskId_idx" ON "AuditEvent"("bookingTaskId");
CREATE INDEX IF NOT EXISTS "AuditEvent_userId_idx" ON "AuditEvent"("userId");
CREATE INDEX IF NOT EXISTS "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");


-- ---------------------------------------------------------------------
-- Record these migrations as applied (so Prisma won't try to re-run them)
-- ---------------------------------------------------------------------
INSERT INTO "_prisma_migrations" ("id", "checksum", "migration_name", "started_at", "finished_at", "applied_steps_count")
SELECT gen_random_uuid()::text, v.checksum, v.name, now(), now(), 1
FROM (VALUES
  ('20260910130000_phase4_provider_capabilities', 'cf971bf167b81b633e78358783e1b92da65cae67f05297ecf6e713215a2ecbee'),
  ('20260910140000_phase5_human_in_the_loop',     '7361ec0f6a05a948f73e9227f4bd541c0e28bc6f2862737e2b3a37afef97daa0'),
  ('20260910150000_phase5_payment',               'd681514ee13886582bd4a9d1d1dbcd35b6a070cbe8ca1fe51f4a46f388d36f4a'),
  ('20260910160000_phase6_ticket_artifacts',      '85365711f1a4c10cf4ac7c33440fba3d8214410cb63adbd8a80bd4feb9c76745'),
  ('20260910170000_phase6_audit_events',          '03bccff650bbb8e17f3863c306d9785b14af0efd1ffee66045c96b8f8a7b4a9a')
) AS v(name, checksum)
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" m WHERE m.migration_name = v.name
);
