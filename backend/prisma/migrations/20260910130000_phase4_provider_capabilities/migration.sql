-- Phase 4: add a first-class UNKNOWN_RESULT booking state so ambiguous
-- provider results are held for reconciliation / human review instead of
-- being collapsed into FAILED.
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'UNKNOWN_RESULT' BEFORE 'COMPLETED';
