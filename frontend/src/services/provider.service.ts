import { api } from './api';
import type { ApiSuccess } from '../types/api';
import type { ProviderInfo } from '../types/provider';

export const providerService = {
  async list() {
    const { data } = await api.get<ApiSuccess<ProviderInfo[]>>('/api/providers');
    return data.data;
  },
  async getByName(name: string) {
    const { data } = await api.get<ApiSuccess<ProviderInfo[]>>(`/api/providers/${name}`);
    return data.data;
  },
};
