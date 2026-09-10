export const PROVIDER_CAPABILITIES = [
  'SEARCH',
  'AVAILABILITY',
  'BOOKING',
  'CANCELLATION',
  'TICKET_DOWNLOAD',
  'PAYMENT',
  'AUTHENTICATION',
  'STATUS_RECONCILIATION',
] as const;

export type ProviderCapability = (typeof PROVIDER_CAPABILITIES)[number];

export class ProviderCapabilitySet {
  private readonly set: Set<ProviderCapability>;

  constructor(capabilities: Iterable<ProviderCapability>) {
    this.set = new Set(capabilities);
  }

  has(capability: ProviderCapability): boolean {
    return this.set.has(capability);
  }

  list(): ProviderCapability[] {
    return PROVIDER_CAPABILITIES.filter((capability) => this.set.has(capability));
  }
}
