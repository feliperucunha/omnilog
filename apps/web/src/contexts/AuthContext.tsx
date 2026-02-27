import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { apiFetch } from "@/lib/api";

const TOKEN_KEY = "logeverything_token";
const USER_KEY = "logeverything_user";

/** Use this as token when session is cookie-based (no token in localStorage). */
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
  /** True while restoring session from cookie (/me) on load. */
  initializing: boolean;
}

interface AuthContextValue extends AuthState {
  login: (token: string, user: User) => void;
  logout: () => Promise<void>;
  setToken: (token: string | null) => void;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const loadStored = (): AuthState => {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const userJson = localStorage.getItem(USER_KEY);
    if (token && userJson && token !== COOKIE_SESSION) {
      const user = JSON.parse(userJson) as User;
      if (user.onboarded === undefined) user.onboarded = true;
      return { token, user, initializing: false };
    }
  } catch {
    // ignore
  }
  return { token: null, user: null, initializing: true };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(loadStored);

  /** Restore session from httpOnly cookie by calling /me. */
  useEffect(() => {
    if (!state.initializing) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<{ user: User }>("/me", {
          skipAuthRedirect: true,
        });
        if (!cancelled && data?.user) {
          setState({
            token: COOKIE_SESSION,
            user: { ...data.user, onboarded: data.user.onboarded ?? true },
            initializing: false,
          });
          return;
        }
      } catch {
        // /me returned 401 or error — not logged in
      }
      if (!cancelled) setState((prev) => ({ ...prev, initializing: false }));
    })();
    return () => {
      cancelled = true;
    };
  }, [state.initializing]);

  /** Listen for 401 from api.ts so we clear state before redirect. */
  useEffect(() => {
    const handleLogout = () => setState({ token: null, user: null, initializing: false });
    window.addEventListener("auth:logout", handleLogout);
    return () => window.removeEventListener("auth:logout", handleLogout);
  }, []);

  const login = useCallback((token: string, user: User) => {
    if (token !== COOKIE_SESSION) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
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
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setState({ token: null, user: null, initializing: false });
  }, []);

  const setToken = useCallback((token: string | null) => {
    setState((prev) => ({ ...prev, token }));
    if (token && token !== COOKIE_SESSION) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }, []);

  const setUser = useCallback((user: User | null) => {
    setState((prev) => ({ ...prev, user }));
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
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
