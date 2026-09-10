import { api } from './api';
import type { ApiSuccess } from '../types/api';
import type {
  BookingInput,
  BookingTask,
  ExecutionLog,
  HumanAction,
  PaymentTransaction,
} from '../types/booking';

export const bookingService = {
  async list() {
    const { data } = await api.get<ApiSuccess<BookingTask[]>>('/api/bookings');
    return data.data;
  },
  async getById(id: string) {
    const { data } = await api.get<ApiSuccess<BookingTask>>(`/api/bookings/${id}`);
    return data.data;
  },
  async create(input: BookingInput) {
    const { data } = await api.post<ApiSuccess<BookingTask>>('/api/bookings', input);
    return data.data;
  },
  async cancel(id: string) {
    const { data } = await api.post<ApiSuccess<BookingTask>>(`/api/bookings/${id}/cancel`);
    return data.data;
  },
  async reschedule(id: string, scheduledAt: string) {
    const { data } = await api.put<ApiSuccess<BookingTask>>(`/api/bookings/${id}/reschedule`, { scheduledAt });
    return data.data;
  },
  async runNow(id: string, mockOutcome?: string) {
    const { data } = await api.post<ApiSuccess<BookingTask>>(`/api/bookings/${id}/run`, {
      ...(mockOutcome ? { mockOutcome } : {}),
    });
    return data.data;
  },
  async resume(id: string) {
    const { data } = await api.post<ApiSuccess<BookingTask>>(`/api/bookings/${id}/resume`);
    return data.data;
  },
  async remove(id: string) {
    await api.delete(`/api/bookings/${id}`);
  },
  async logs(id: string) {
    const { data } = await api.get<ApiSuccess<ExecutionLog[]>>(`/api/bookings/${id}/logs`);
    return data.data;
  },
  async actions(id: string) {
    const { data } = await api.get<ApiSuccess<HumanAction[]>>(`/api/bookings/${id}/actions`);
    return data.data;
  },
  async resolveAction(id: string, actionId: string) {
    const { data } = await api.post<ApiSuccess<HumanAction>>(
      `/api/bookings/${id}/actions/${actionId}/resolve`,
    );
    return data.data;
  },
  async payments(id: string) {
    const { data } = await api.get<ApiSuccess<PaymentTransaction[]>>(`/api/bookings/${id}/payment`);
    return data.data;
  },
  async authorizePayment(id: string) {
    const { data } = await api.post<ApiSuccess<PaymentTransaction>>(
      `/api/bookings/${id}/payment/authorize`,
    );
    return data.data;
  },
};
