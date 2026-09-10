-- Phase 5: payment abstraction. Only transaction bookkeeping is stored.
-- No raw card number, CVV, UPI PIN, or OTP is ever persisted.

CREATE TABLE "PaymentTransaction" (
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
CREATE INDEX "PaymentTransaction_bookingTaskId_idx" ON "PaymentTransaction"("bookingTaskId");
CREATE INDEX "PaymentTransaction_status_idx" ON "PaymentTransaction"("status");
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_bookingTaskId_fkey"
    FOREIGN KEY ("bookingTaskId") REFERENCES "BookingTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
