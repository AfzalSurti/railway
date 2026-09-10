-- CreateEnum
CREATE TYPE "ActionRequiredType" AS ENUM ('NONE', 'LOGIN', 'OTP', 'CAPTCHA', 'PAYMENT', 'CONFIRMATION', 'MANUAL_REVIEW');

-- AlterTable
ALTER TABLE "BookingTask" ADD COLUMN     "actionRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "actionRequiredType" "ActionRequiredType" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "actionRequiredMessage" TEXT,
ADD COLUMN     "currentStage" TEXT,
ADD COLUMN     "providerStatus" TEXT,
ADD COLUMN     "artifactId" TEXT;
