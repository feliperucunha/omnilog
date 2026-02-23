import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

const TOKEN_KEY = "logeverything_token";
const USER_KEY = "logeverything_user";

interface User {
  id: string;
  email: string;
  onboarded?: boolean;
}

interface AuthState {
  token: string | null;
  user: User | null;
}

interface AuthContextValue extends AuthState {
  login: (token: string, user: User) => void;
  logout: () => void;
  setToken: (token: string | null) => void;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const loadStored = (): AuthState => {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const userJson = localStorage.getItem(USER_KEY);
    if (token && userJson) {
      const user = JSON.parse(userJson) as User;
      if (user.onboarded === undefined) user.onboarded = true;
      return { token, user };
    }
  } catch {
    // ignore
  }
  return { token: null, user: null };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(loadStored);

  const login = useCallback((token: string, user: User) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    setState({ token, user });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setState({ token: null, user: null });
  }, []);

  const setToken = useCallback((token: string | null) => {
    setState((prev) => ({ ...prev, token }));
    if (token) localStorage.setItem(TOKEN_KEY, token);
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
