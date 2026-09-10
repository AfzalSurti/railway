export const SERVICE_TYPES = ['TRAIN', 'BUS', 'FLIGHT'] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const PROVIDER_NAMES = ['MOCK', 'IRCTC'] as const;
export type ProviderName = (typeof PROVIDER_NAMES)[number];

export const AVAILABILITY_STATUSES = [
  'AVAILABLE',
  'RAC',
  'WAITLIST',
  'NOT_AVAILABLE',
  'UNKNOWN',
] as const;
export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];

export const BOOKING_RESULT_STATUSES = [
  'SUCCESS',
  'FAILED',
  'AUTHENTICATION_REQUIRED',
  'PAYMENT_REQUIRED',
  'CAPTCHA_REQUIRED',
  'UNKNOWN_RESULT',
] as const;
export type BookingResultStatus = (typeof BOOKING_RESULT_STATUSES)[number];

export const ACTION_REQUIRED_TYPES = [
  'NONE',
  'LOGIN',
  'OTP',
  'CAPTCHA',
  'PAYMENT',
  'CONFIRMATION',
  'MANUAL_REVIEW',
] as const;
export type ActionRequiredType = (typeof ACTION_REQUIRED_TYPES)[number];

export const PROVIDER_HEALTH_STATUSES = [
  'AVAILABLE',
  'UNAVAILABLE',
  'NOT_IMPLEMENTED',
  'AUTH_REQUIRED',
] as const;
export type ProviderHealthStatus = (typeof PROVIDER_HEALTH_STATUSES)[number];

export const EXECUTION_STAGES = [
  'INITIALIZING',
  'OPENING_PROVIDER',
  'SEARCHING',
  'VERIFYING_JOURNEY',
  'CHECKING_AVAILABILITY',
  'SELECTING_JOURNEY',
  'SELECTING_CLASS',
  'ENTERING_PASSENGER_DETAILS',
  'AUTHENTICATION_REQUIRED',
  'PAYMENT_REQUIRED',
  'CONFIRMING_BOOKING',
  'BOOKING_CONFIRMED',
  'BOOKING_FAILED',
  'UNKNOWN_RESULT',
] as const;
export type ExecutionStage = (typeof EXECUTION_STAGES)[number];

export type ProviderPassenger = {
  name: string;
  age: number;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
};

export type SearchRequest = {
  serviceType: ServiceType;
  source: string;
  destination: string;
  journeyDate: string;
  trainNumber?: string;
  departureTime?: string;
  serviceClass?: string;
  quota?: string;
};

export type JourneyOption = {
  providerTrainId: string;
  trainNumber: string;
  trainName: string;
  source: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  classes: string[];
};

export type SearchResult = {
  found: boolean;
  journeys: JourneyOption[];
  message?: string;
};

export type AvailabilityRequest = {
  journey: JourneyOption;
  travelClass?: string;
  quota?: string;
};

export type AvailabilityOption = {
  class: string;
  status: AvailabilityStatus;
  seats: number | null;
};

export type AvailabilityResult = {
  available: boolean;
  options: AvailabilityOption[];
  message?: string;
};

export type BookingPreparationResult = {
  ready: boolean;
  message: string;
  actionRequiredType?: Exclude<ActionRequiredType, 'NONE'>;
};

export type BookingResult = {
  status: BookingResultStatus;
  message: string;
  providerBookingReference?: string;
  failureCode?: string;
  actionRequiredType?: Exclude<ActionRequiredType, 'NONE'>;
  retryable?: boolean;
};

export type ProviderDescriptor = {
  name: string;
  serviceType: ServiceType;
  available: boolean;
  health: ProviderHealthStatus;
  description: string;
};
