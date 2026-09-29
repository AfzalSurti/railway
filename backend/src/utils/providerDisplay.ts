/**
 * Cosmetic-only mapping from a provider's internal code to a friendlier name
 * for human-readable log/audit messages. The internal code (metadata,
 * booking.provider, ticket references, etc.) is never changed by this —
 * only what a person reads in a message string.
 */
const DISPLAY_NAMES: Record<string, string> = {
  MOCK: 'Voyage Network',
};

export function providerDisplayName(code: string): string {
  return DISPLAY_NAMES[code.toUpperCase()] ?? code;
}
