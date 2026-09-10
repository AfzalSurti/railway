import { ProviderPassenger, ServiceType } from '../provider.types';
import { MockExecutorOutcome } from '../../config/env';

export type ProviderContext = {
  bookingTaskId: string;
  serviceType: ServiceType;
  provider: string;
  source: string;
  destination: string;
  journeyDate: string;
  scheduledAt: string;
  trainNumber: string | null;
  travelClass: string | null;
  quota: string | null;
  passengers: ProviderPassenger[];
  mockOutcome?: MockExecutorOutcome | null;
};
