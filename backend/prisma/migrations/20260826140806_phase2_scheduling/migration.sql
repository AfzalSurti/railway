-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "BookingTask" ADD COLUMN     "bookingReference" TEXT,
ADD COLUMN     "cancellationRequested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "failedAt" TIMESTAMP(3),
ADD COLUMN     "failureCode" TEXT,
ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "lastAttemptAt" TIMESTAMP(3),
ADD COLUMN     "mockOutcome" TEXT,
ADD COLUMN     "queueJobId" TEXT,
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "startedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "BookingAttempt" (
    "id" TEXT NOT NULL,
    "bookingTaskId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" "AttemptStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingAttempt_bookingTaskId_idx" ON "BookingAttempt"("bookingTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingAttempt_bookingTaskId_attemptNumber_key" ON "BookingAttempt"("bookingTaskId", "attemptNumber");

-- AddForeignKey
ALTER TABLE "BookingAttempt" ADD CONSTRAINT "BookingAttempt_bookingTaskId_fkey" FOREIGN KEY ("bookingTaskId") REFERENCES "BookingTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
