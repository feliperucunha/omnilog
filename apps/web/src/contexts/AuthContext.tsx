import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import { apiFetch, ApiError } from "@/lib/api";
import { resetSessionLogsCacheWarm } from "@/lib/logsPageCache";
import * as storage from "@/lib/storage";
import { clearAuthSession } from "@/lib/storage";

const TOKEN_KEY = "geeklogs_token";
const USER_KEY = "geeklogs_user";

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
  signingOut: boolean;
  setSigningOut: (value: boolean) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function isNative(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as Window & { Capacitor?: { isNativePlatform?: () => boolean } };
  return Boolean(w?.Capacitor?.isNativePlatform?.());
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (signingOut && location.pathname === "/login") {
      setSigningOut(false);
    }
  }, [location.pathname, signingOut]);

  const [state, setState] = useState<AuthState>(() => ({
    token: null,
    user: null,
    initializing: true,
  }));

  /** Load from storage first (web: localStorage + cookie; native: Capacitor Preferences + localStorage fallback). Then cookie /me on web if none. */
  useEffect(() => {
    let cancelled = false;
    const native = isNative();

    const authTimeoutMs = native ? 60_000 : 120_000;
    const timeoutId = setTimeout(() => {
      if (cancelled) return;
      setState((prev) => (prev.initializing ? { ...prev, initializing: false } : prev));
    }, authTimeoutMs);

    (async () => {
      try {
        const [token, userJson] = await Promise.all([
          storage.getItem(TOKEN_KEY),
          storage.getItem(USER_KEY),
        ]);
        if (cancelled) return;
        if (token && userJson && token !== COOKIE_SESSION) {
          try {
            const parsed = JSON.parse(userJson) as User;
            setState({
              token,
              user: { ...parsed, onboarded: parsed.onboarded ?? true },
              initializing: true,
            });
          } catch {
            // ignore corrupt cache; validate via /me below
          }
          try {
            const data = await apiFetch<{ user: User }>("/me", {
              skipAuthRedirect: true,
              timeout: 60_000,
            });
            if (cancelled) return;
            if (data?.user) {
              const user = { ...data.user, onboarded: data.user.onboarded ?? true };
              await storage.setItem(TOKEN_KEY, token);
              await storage.setItem(USER_KEY, JSON.stringify(user));
              setState({ token, user, initializing: false });
              return;
            }
          } catch (e) {
            if (cancelled) return;
            if (!(e instanceof ApiError && e.statusCode === 401)) {
              // network / server — fall through to unauthenticated
            }
          }
          await clearAuthSession();
        }
      } catch {
        // ignore
      }
      if (cancelled) return;
      // No stored session — on native we're done; on web try cookie /me
      if (native) {
        setState((prev) => ({ ...prev, initializing: false }));
        return;
      }
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
      /** Extra outer retries if all inner apiFetch attempts still fail (e.g. host waking up). */
      attempt(2);
    })();

    return () => {
      cancelled = true;
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, []);

  /** Listen for 401 from api.ts so we clear state before redirect. */

  /** Listen for 401 from api.ts so we clear state before redirect. */
  useEffect(() => {
    const handleLogout = () => {
      resetSessionLogsCacheWarm();
      void clearAuthSession();
      setState({ token: null, user: null, initializing: false });
    };
    window.addEventListener("auth:logout", handleLogout);
    return () => window.removeEventListener("auth:logout", handleLogout);
  }, []);

  const login = useCallback(async (token: string, user: User) => {
    resetSessionLogsCacheWarm();
    if (token !== COOKIE_SESSION) {
      await Promise.all([
        storage.setItem(TOKEN_KEY, token),
        storage.setItem(USER_KEY, JSON.stringify(user)),
      ]);
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
    resetSessionLogsCacheWarm();
    await clearAuthSession();
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
    signingOut,
    setSigningOut,
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
