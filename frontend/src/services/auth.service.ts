import { api } from './api';
import { tokenStore } from './authStorage';
import type { ApiSuccess } from '../types/api';
import type { AuthPayload, PublicUser } from '../types/auth';

export const authService = {
  async register(input: { name: string; email: string; phone: string; password: string }) {
    const { data } = await api.post<ApiSuccess<AuthPayload>>('/api/auth/register', input);
    tokenStore.set(data.data.token);
    return data.data;
  },

  async login(input: { email: string; password: string }) {
    const { data } = await api.post<ApiSuccess<AuthPayload>>('/api/auth/login', input);
    tokenStore.set(data.data.token);
    return data.data;
  },

  async me() {
    const { data } = await api.get<ApiSuccess<{ user: PublicUser }>>('/api/auth/me');
    return data.data.user;
  },

  logout() {
    tokenStore.clear();
  },
};
