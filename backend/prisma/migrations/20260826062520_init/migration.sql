-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('TRAIN', 'BUS', 'FLIGHT');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'QUEUED', 'RUNNING', 'AUTHENTICATION_REQUIRED', 'PAYMENT_REQUIRED', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Passenger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "gender" "Gender" NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Passenger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "provider" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "journeyDate" DATE NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "trainNumber" TEXT,
    "travelClass" TEXT,
    "quota" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingPassenger" (
    "bookingTaskId" TEXT NOT NULL,
    "passengerId" TEXT NOT NULL,

    CONSTRAINT "BookingPassenger_pkey" PRIMARY KEY ("bookingTaskId","passengerId")
);

-- CreateTable
CREATE TABLE "ExecutionLog" (
    "id" TEXT NOT NULL,
    "bookingTaskId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "status" "ExecutionStatus" NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Passenger_userId_idx" ON "Passenger"("userId");

-- CreateIndex
CREATE INDEX "BookingTask_userId_idx" ON "BookingTask"("userId");

-- CreateIndex
CREATE INDEX "BookingTask_status_idx" ON "BookingTask"("status");

-- CreateIndex
CREATE INDEX "BookingTask_scheduledAt_idx" ON "BookingTask"("scheduledAt");

-- CreateIndex
CREATE INDEX "ExecutionLog_bookingTaskId_idx" ON "ExecutionLog"("bookingTaskId");

-- AddForeignKey
ALTER TABLE "Passenger" ADD CONSTRAINT "Passenger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingTask" ADD CONSTRAINT "BookingTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingPassenger" ADD CONSTRAINT "BookingPassenger_bookingTaskId_fkey" FOREIGN KEY ("bookingTaskId") REFERENCES "BookingTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingPassenger" ADD CONSTRAINT "BookingPassenger_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "Passenger"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionLog" ADD CONSTRAINT "ExecutionLog_bookingTaskId_fkey" FOREIGN KEY ("bookingTaskId") REFERENCES "BookingTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
