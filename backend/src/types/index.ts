import { BookingStatus, ExecutionStatus, Gender, ServiceType } from '@prisma/client';

export type { BookingStatus, ExecutionStatus, Gender, ServiceType };

export type AuthUserPayload = {
  id: string;
  name: string;
  email: string;
  phone: string;
};
