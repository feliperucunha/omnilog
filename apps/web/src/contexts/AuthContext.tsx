import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { apiFetch, ApiError } from "@/lib/api";
import * as storage from "@/lib/storage";

const TOKEN_KEY = "dogument_token";
const USER_KEY = "dogument_user";

/** Use this as token when session is cookie-based (no token in storage). */
export const COOKIE_SESSION = "cookie";

interface User {
  id: string;
  username?: string;
  email: string;
  onboarded?: boolean;
}

interface AuthState {
  token: string | null;
  user: User | null;
  /** True while restoring session from storage or cookie (/me) on load. */
  initializing: boolean;
}

interface AuthContextValue extends AuthState {
  login: (token: string, user: User) => void;
  logout: () => Promise<void>;
  setToken: (token: string | null) => void;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ token: null, user: null, initializing: true });

  /** Load from persistent storage first (Capacitor Preferences on native, localStorage on web). Then cookie /me if none. */
  useEffect(() => {
    let cancelled = false;
    /** Safety: if storage or /me hangs (e.g. on Android), stop showing "checking session" after this. */
    const INIT_TIMEOUT_MS = 25_000;
    const timeoutId = setTimeout(() => {
      if (cancelled) return;
      setState((prev) => (prev.initializing ? { ...prev, initializing: false } : prev));
    }, INIT_TIMEOUT_MS);

    (async () => {
      try {
        const storageTimeoutMs = 5_000;
        const [token, userJson] = await Promise.race([
          Promise.all([storage.getItem(TOKEN_KEY), storage.getItem(USER_KEY)]),
          new Promise<[string | null, string | null]>((_, reject) =>
            setTimeout(() => reject(new Error("storage timeout")), storageTimeoutMs)
          ),
        ]).catch(() => [null, null] as [string | null, string | null]);
        if (cancelled) return;
        if (token && userJson && token !== COOKIE_SESSION) {
          try {
            const user = JSON.parse(userJson) as User;
            if (user.onboarded === undefined) user.onboarded = true;
            setState({ token, user, initializing: false });
            return;
          } catch {
            // invalid user json
          }
        }
      } catch {
        // ignore
      }
      if (cancelled) return;
      // No stored session — try cookie /me
      const attempt = (retryCount: number) => {
        apiFetch<{ user: User }>("/me", {
          skipAuthRedirect: true,
          timeout: 60_000,
        })
          .then((data) => {
            if (cancelled) return;
            if (data?.user) {
              setState({
                token: COOKIE_SESSION,
                user: { ...data.user, onboarded: data.user.onboarded ?? true },
                initializing: false,
              });
            } else {
              setState((prev) => ({ ...prev, initializing: false }));
            }
          })
          .catch((e) => {
            if (cancelled) return;
            if (e instanceof ApiError && e.statusCode === 401) {
              setState((prev) => ({ ...prev, initializing: false }));
              return;
            }
            if (retryCount > 0) {
              setTimeout(() => attempt(retryCount - 1), 2000);
            } else {
              setState((prev) => ({ ...prev, initializing: false }));
            }
          });
      };
      attempt(1);
    })();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  /** Listen for 401 from api.ts so we clear state before redirect. */

  /** Listen for 401 from api.ts so we clear state before redirect. */
  useEffect(() => {
    const handleLogout = () => setState({ token: null, user: null, initializing: false });
    window.addEventListener("auth:logout", handleLogout);
    return () => window.removeEventListener("auth:logout", handleLogout);
  }, []);

  const login = useCallback((token: string, user: User) => {
    if (token !== COOKIE_SESSION) {
      void storage.setItem(TOKEN_KEY, token);
      void storage.setItem(USER_KEY, JSON.stringify(user));
    }
    setState({ token, user, initializing: false });
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/auth/logout", {
        method: "POST",
        skipAuthRedirect: true,
      });
    } catch {
      // ignore network errors; still clear local state
    }
    await storage.removeItem(TOKEN_KEY);
    await storage.removeItem(USER_KEY);
    setState({ token: null, user: null, initializing: false });
  }, []);

  const setToken = useCallback((token: string | null) => {
    setState((prev) => ({ ...prev, token }));
    if (token && token !== COOKIE_SESSION) void storage.setItem(TOKEN_KEY, token);
    else void storage.removeItem(TOKEN_KEY);
  }, []);

  const setUser = useCallback((user: User | null) => {
    setState((prev) => ({ ...prev, user }));
    if (user) void storage.setItem(USER_KEY, JSON.stringify(user));
    else void storage.removeItem(USER_KEY);
  }, []);

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    setToken,
    setUser,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
