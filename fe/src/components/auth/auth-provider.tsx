'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { authApi, type AppUser } from '@/lib/api';
import { ApiError, setApiReadOnly } from '@/lib/api/client';
import { canWrite, isReadOnlyUser } from '@/lib/features';
import {
  clearStoredAuthToken,
  getStoredAuthToken,
  setStoredAuthToken,
} from '@/lib/auth-storage';

type AuthContextValue = {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const PUBLIC_PATHS = ['/login', '/forms'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = getStoredAuthToken();
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const me = await authApi.me();
      setUser(me);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        clearStoredAuthToken();
      }
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await refreshUser();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshUser]);

  useEffect(() => {
    if (loading) return;
    const isPublic = PUBLIC_PATHS.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    );
    if (!user && !isPublic) {
      router.replace('/login');
      return;
    }
    if (user && pathname === '/login') {
      router.replace('/');
    }
  }, [loading, user, pathname, router]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await authApi.login(email, password);
      setStoredAuthToken(res.accessToken);
      setUser(res.user);
      router.replace('/');
    },
    [router],
  );

  const logout = useCallback(() => {
    clearStoredAuthToken();
    setUser(null);
    router.replace('/login');
  }, [router]);

  // Đặt đồng bộ trong render để request ghi không lọt qua trước khi effect chạy
  setApiReadOnly(isReadOnlyUser(user));

  const value = useMemo(
    () => ({ user, loading, login, logout, refreshUser }),
    [user, loading, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** false với tài khoản chỉ xem — dùng để ẩn nút thêm / sửa / xóa */
export function useCanWrite() {
  return canWrite(useContext(AuthContext)?.user);
}

/** Chỉ hiện nội dung con khi tài khoản được ghi dữ liệu */
export function WriteOnly({ children }: { children: ReactNode }) {
  return useCanWrite() ? <>{children}</> : null;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
