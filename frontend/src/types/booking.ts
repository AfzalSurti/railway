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

export type HumanActionType = 'LOGIN' | 'OTP' | 'CAPTCHA' | 'PAYMENT' | 'CONFIRMATION' | 'MANUAL_REVIEW';
export type HumanActionStatus = 'PENDING' | 'RESOLVED' | 'EXPIRED' | 'CANCELLED';

export type HumanAction = {
  id: string;
  bookingTaskId: string;
  type: HumanActionType;
  status: HumanActionStatus;
  message: string;
  createdAt: string;
  resolvedAt: string | null;
  expiresAt: string;
};

export type PaymentStatus = 'REQUIRED' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

export type PaymentTransaction = {
  id: string;
  bookingTaskId: string;
  provider: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TicketArtifact = {
  id: string;
  bookingTaskId: string;
  provider: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export type BookingAttempt = {
  id: string;
  attemptNumber: number;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  startedAt: string;
  endedAt: string | null;
  failureCode: string | null;
  failureReason: string | null;
};

export type AuditEvent = {
  id: string;
  action: string;
  provider: string | null;
  result: string | null;
  createdAt: string;
};
