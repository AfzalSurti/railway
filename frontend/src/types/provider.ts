export type ProviderHealth = 'AVAILABLE' | 'UNAVAILABLE' | 'NOT_IMPLEMENTED' | 'AUTH_REQUIRED';

export type ProviderInfo = {
  name: string;
  serviceType: 'TRAIN' | 'BUS' | 'FLIGHT';
  available: boolean;
  health: ProviderHealth;
  description: string;
};
