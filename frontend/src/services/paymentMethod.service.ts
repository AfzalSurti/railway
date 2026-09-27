import { api } from './api';
import type { ApiSuccess } from '../types/api';
import type { PaymentMethodInfo } from '../types/paymentMethod';

export const paymentMethodService = {
  async list() {
    const { data } = await api.get<ApiSuccess<PaymentMethodInfo[]>>('/api/payment-methods');
    return data.data;
  },
  async create(input: { label: string; brand: string; last4: string; autoPay?: boolean }) {
    const { data } = await api.post<ApiSuccess<PaymentMethodInfo>>('/api/payment-methods', input);
    return data.data;
  },
  async setAutoPay(id: string, autoPay: boolean) {
    const { data } = await api.patch<ApiSuccess<PaymentMethodInfo>>(`/api/payment-methods/${id}/auto-pay`, { autoPay });
    return data.data;
  },
  async remove(id: string) {
    await api.delete(`/api/payment-methods/${id}`);
  },
};
