import { api } from './api';
import type { ApiSuccess } from '../types/api';
import type { Passenger, PassengerInput } from '../types/passenger';

export const passengerService = {
  async list() {
    const { data } = await api.get<ApiSuccess<Passenger[]>>('/api/passengers');
    return data.data;
  },
  async create(input: PassengerInput) {
    const { data } = await api.post<ApiSuccess<Passenger>>('/api/passengers', input);
    return data.data;
  },
  async update(id: string, input: Partial<PassengerInput>) {
    const { data } = await api.put<ApiSuccess<Passenger>>(`/api/passengers/${id}`, input);
    return data.data;
  },
  async remove(id: string) {
    await api.delete(`/api/passengers/${id}`);
  },
};
