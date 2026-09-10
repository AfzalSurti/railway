-- Phase 5: human-in-the-loop + provider session abstraction.

CREATE TYPE "HumanActionType" AS ENUM ('LOGIN', 'OTP', 'CAPTCHA', 'PAYMENT', 'CONFIRMATION', 'MANUAL_REVIEW');
CREATE TYPE "HumanActionStatus" AS ENUM ('PENDING', 'RESOLVED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "ProviderSessionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');
CREATE TYPE "PaymentStatus" AS ENUM ('REQUIRED', 'PROCESSING', 'SUCCESS', 'FAILED', 'CANCELLED');

CREATE TABLE "HumanActionRequest" (
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
CREATE INDEX "HumanActionRequest_bookingTaskId_idx" ON "HumanActionRequest"("bookingTaskId");
CREATE INDEX "HumanActionRequest_status_idx" ON "HumanActionRequest"("status");
ALTER TABLE "HumanActionRequest" ADD CONSTRAINT "HumanActionRequest_bookingTaskId_fkey"
    FOREIGN KEY ("bookingTaskId") REFERENCES "BookingTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProviderSession" (
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
CREATE INDEX "ProviderSession_userId_provider_idx" ON "ProviderSession"("userId", "provider");
CREATE INDEX "ProviderSession_status_idx" ON "ProviderSession"("status");
ALTER TABLE "ProviderSession" ADD CONSTRAINT "ProviderSession_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
