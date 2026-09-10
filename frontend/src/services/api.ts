import axios, { AxiosError } from 'axios';
import type { ApiErrorBody } from '../types/api';
import { tokenStore } from './authStorage';

const baseURL = import.meta.env.VITE_API_URL;

if (!baseURL) {
  throw new Error('VITE_API_URL is not configured');
}

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorBody>;
    return axiosError.response?.data?.error?.message ?? fallback;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}
