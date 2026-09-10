const TOKEN_KEY = 'ata_access_token';

/**
 * Token storage is isolated so Phase 2 can switch to HttpOnly cookies
 * without rewriting page-level auth calls.
 */
export const tokenStore = {
  get(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  set(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clear(): void {
    localStorage.removeItem(TOKEN_KEY);
  },
};
