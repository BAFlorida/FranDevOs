import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
  createElement,
  type ReactNode,
} from "react";
import type { AuthUser } from "@workspace/api-client-react";

export type { AuthUser };

export interface LoginResult {
  ok: boolean;
  error?: string;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

function appBase(): string {
  return import.meta.env.BASE_URL?.replace(/\/+$/, "") || "";
}

function useAuthState(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/user", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { user: AuthUser | null };
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUser();
  }, [fetchUser]);

  const login = useCallback<AuthState["login"]>(
    async (email, password) => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
          let error = "Sign in failed. Please try again.";
          try {
            const body = (await res.json()) as { error?: string };
            if (body?.error) error = body.error;
          } catch {
            // ignore parse failures, keep default message
          }
          return { ok: false, error };
        }
        await fetchUser();
        return { ok: true };
      } catch {
        return { ok: false, error: "Network error. Please try again." };
      }
    },
    [fetchUser],
  );

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore — clear local state regardless
    }
    setUser(null);
    window.location.href = appBase() || "/";
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    refresh: fetchUser,
  };
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * Provides a single shared auth state to the whole tree. Without this, each
 * `useAuth()` call would own independent state, so a successful login in one
 * component would not be visible to the router gate in another.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const value = useAuthState();
  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an <AuthProvider>");
  }
  return ctx;
}
