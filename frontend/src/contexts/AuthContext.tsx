import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AuthContext } from '../hooks/useAuth';
import { authService } from '../services/auth.service';
import { tokenStore } from '../services/authStorage';
import type { PublicUser } from '../types/auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = tokenStore.get();
    if (!token) {
      setLoading(false);
      return;
    }
    authService
      .me()
      .then(setUser)
      .catch(() => {
        tokenStore.clear();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authService.login({ email, password });
    setUser(result.user);
  }, []);

  const register = useCallback(
    async (input: { name: string; email: string; phone: string; password: string }) => {
      const result = await authService.register(input);
      setUser(result.user);
    },
    [],
  );

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
