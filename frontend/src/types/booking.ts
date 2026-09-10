import type { Gender } from './passenger';

export type ServiceType = 'TRAIN' | 'BUS' | 'FLIGHT';

export type BookingStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'QUEUED'
  | 'RUNNING'
  | 'AUTHENTICATION_REQUIRED'
  | 'PAYMENT_REQUIRED'
  | 'UNKNOWN_RESULT'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type ExecutionStatus = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

export type BookingPassenger = {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  phone: string;
};

export type BookingTask = {
  id: string;
  serviceType: ServiceType;
  provider: string;
  source: string;
  destination: string;
  journeyDate: string;
  scheduledAt: string;
  trainNumber: string | null;
  travelClass: string | null;
  quota: string | null;
  status: BookingStatus;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  retryCount: number;
  failureCode: string | null;
  failureReason: string | null;
  lastAttemptAt: string | null;
  bookingReference: string | null;
  cancellationRequested: boolean;
  actionRequired: boolean;
  actionRequiredType: 'NONE' | 'LOGIN' | 'OTP' | 'CAPTCHA' | 'PAYMENT' | 'CONFIRMATION' | 'MANUAL_REVIEW';
  actionRequiredMessage: string | null;
  currentStage: string | null;
  providerStatus: string | null;
  artifactId: string | null;
  passengers: BookingPassenger[];
  createdAt: string;
  updatedAt: string;
};

export type BookingInput = {
  serviceType: ServiceType;
  provider: string;
  source: string;
  destination: string;
  journeyDate: string;
  scheduledAt: string;
  trainNumber?: string;
  travelClass?: string;
  quota?: string;
  passengerIds: string[];
};

export type ExecutionLog = {
  id: string;
  bookingTaskId: string;
  step: string;
  status: ExecutionStatus;
  message: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};
