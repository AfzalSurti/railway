/**
 * Cosmetic-only mapping from a provider's internal code to a friendlier
 * on-screen name. The underlying identifier (sent to the API, stored on the
 * booking, used in ticket filenames, etc.) never changes — this only touches
 * what the user reads. It does not change what the provider actually is: a
 * simulated data source, not a live connection to a real railway, bus, or
 * airline system.
 */
const DISPLAY_NAMES: Record<string, string> = {
  MOCK: 'Voyage Network',
};

export function providerDisplayName(code: string | null | undefined): string {
  if (!code) return '—';
  return DISPLAY_NAMES[code.toUpperCase()] ?? code;
}
