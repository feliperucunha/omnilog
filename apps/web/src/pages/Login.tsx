import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Fingerprint, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/PasswordInput";
import { useLocale } from "@/contexts/LocaleContext";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/Logo";
import { AuthNavbar } from "@/components/AuthNavbar";
import { toast } from "sonner";
import { showErrorToast } from "@/lib/errorToast";
import { apiFetch, ApiValidationError } from "@/lib/api";
import { OverflowMarquee } from "@/components/OverflowMarquee";
import { cn } from "@/lib/utils";
import { safeInternalPathFromQuery } from "@/lib/safeInternalPath";
import * as storage from "@/lib/storage";
import {
  clearSecureCredentials,
  hasSecureCredentials,
  isSecureCredentialStorageAvailable,
  loadSecureCredentials,
  saveSecureCredentials,
} from "@/lib/secureCredentials";
import type { AuthResponse } from "@geeklogs/shared";
import { modalContentVariants } from "@/lib/animations";

const REMEMBER_LOGIN_KEY = "geeklogs-remember-login";

type LoginFieldErrors = Partial<Record<"email" | "password", string>>;

export function Login() {
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [secureStorageAvailable, setSecureStorageAvailable] = useState(false);
  const [hasSecureLogin, setHasSecureLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [secureAvailable, secureSaved] = await Promise.all([
        isSecureCredentialStorageAvailable(),
        hasSecureCredentials(),
      ]);
      if (cancelled) return;
      setSecureStorageAvailable(secureAvailable);
      setHasSecureLogin(secureSaved);
      if (secureSaved) return;
      const raw = await storage.getItem(REMEMBER_LOGIN_KEY);
      if (cancelled || !raw) return;
      try {
        const data = JSON.parse(raw) as { email?: string } | null;
        const parsedEmail = typeof data?.email === "string" ? data.email : "";
        setEmail(parsedEmail);
        setRememberMe(!!parsedEmail);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const completeLogin = useCallback(
    async (data: AuthResponse) => {
      await login(data.token, { ...data.user, onboarded: data.user.onboarded ?? true });
      toast.success(t("toast.welcomeBack"));
      const from = safeInternalPathFromQuery(searchParams.get("from"));
      if (from) {
        navigate(from, { replace: true });
        return;
      }
      navigate(data.user.onboarded ? "/search" : "/onboarding", { replace: true });
    },
    [login, navigate, searchParams, t]
  );

  const persistRememberMe = useCallback(
    async (loginEmail: string, loginPassword: string) => {
      if (secureStorageAvailable) {
        await saveSecureCredentials(loginEmail, loginPassword);
        setHasSecureLogin(true);
        await storage.removeItem(REMEMBER_LOGIN_KEY);
        return;
      }
      await storage.setItem(REMEMBER_LOGIN_KEY, JSON.stringify({ email: loginEmail }));
    },
    [secureStorageAvailable]
  );

  const clearRememberMe = useCallback(async () => {
    if (secureStorageAvailable) {
      await clearSecureCredentials();
      setHasSecureLogin(false);
    }
    await storage.removeItem(REMEMBER_LOGIN_KEY);
  }, [secureStorageAvailable]);

  const clearFieldError = (field: keyof LoginFieldErrors) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleBiometricSignIn = async () => {
    setFieldErrors({});
    setBiometricLoading(true);
    try {
      const creds = await loadSecureCredentials({
        reason: t("login.biometricReason"),
        title: t("login.biometricTitle"),
        subtitle: t("app.name"),
        description: t("login.biometricDescription"),
        negativeButtonText: t("common.cancel"),
      });
      if (!creds) return;
      const data = await apiFetch<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: creds.username,
          password: creds.password,
        }),
        skipAuthRedirect: true,
        timeout: 25_000,
      });
      await completeLogin(data);
    } catch (err) {
      showErrorToast(t, "E002", { originalError: err });
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: LoginFieldErrors = {};
    if (!email.trim()) errors.email = t("login.emailOrUsername") + " is required";
    if (!password) errors.password = t("login.password") + " is required";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      showErrorToast(t, "E001");
      return;
    }
    setFieldErrors({});
    setLoading(true);
    try {
      const data = await apiFetch<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
        skipAuthRedirect: true,
        timeout: 25_000,
      });
      if (rememberMe) {
        await persistRememberMe(email.trim(), password);
      } else {
        await clearRememberMe();
      }
      await completeLogin(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("toast.loginFailed");
      if (err instanceof ApiValidationError) {
        const mapped: LoginFieldErrors = {};
        if (err.fieldErrors.email) mapped.email = err.fieldErrors.email;
        if (err.fieldErrors.password) mapped.password = err.fieldErrors.password;
        setFieldErrors(mapped);
      } else {
        setFieldErrors({ email: msg, password: msg });
      }
      showErrorToast(t, "E002", { originalError: err });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-darkest)]">
      <AuthNavbar />
      <div className="flex flex-1 items-center justify-center p-4">
      <motion.div
        initial="initial"
        animate="animate"
        variants={modalContentVariants}
        className="w-full max-w-[400px]"
      >
        <Card className="w-full border-[var(--color-surface-border)] bg-[var(--color-dark)] shadow-[var(--shadow-modal)]">
          <CardHeader className="flex flex-col items-center gap-4 text-center">
            <Logo alt="" className="h-24! w-auto sm:h-16" />
            <h1 className="-mt-6 flex min-w-0 w-full flex-col gap-0.5 text-2xl font-bold text-[var(--color-lightest)]">
              <OverflowMarquee>{t("app.name")}</OverflowMarquee>
              <OverflowMarquee className="text-lg font-normal text-[var(--color-light)]">
                {t("app.subtitle")}
              </OverflowMarquee>
            </h1>
          </CardHeader>
          <CardContent className="pt-0">
            {hasSecureLogin && (
              <motion.div whileTap={{ scale: 0.98 }} transition={{ duration: 0.1 }} className="mb-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={loading || biometricLoading}
                  onClick={() => void handleBiometricSignIn()}
                  aria-busy={biometricLoading}
                >
                  {biometricLoading ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                      {t("login.biometricSigningIn")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center gap-2">
                      <Fingerprint className="h-4 w-4 shrink-0" aria-hidden />
                      {t("login.biometricSignIn")}
                    </span>
                  )}
                </Button>
              </motion.div>
            )}
            <form onSubmit={handleSubmit} aria-busy={loading}>
              <div className="flex flex-col gap-4">
                <div className="space-y-2">
                  <Label>{t("login.emailOrUsername")}</Label>
                  <Input
                    type="text"
                    autoComplete="username"
                    placeholder={t("login.emailOrUsername")}
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); clearFieldError("email"); }}
                    disabled={loading}
                    required
                    className={cn(fieldErrors.email && "border-red-500 focus-visible:ring-red-500")}
                    aria-invalid={!!fieldErrors.email}
                    aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
                  />
                  {fieldErrors.email && (
                    <p id="login-email-error" className="text-xs text-red-500" role="alert">
                      {fieldErrors.email}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>{t("login.password")}</Label>
                  <PasswordInput
                    autoComplete="current-password"
                    placeholder={t("common.placeholderPassword")}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); clearFieldError("password"); }}
                    disabled={loading}
                    required
                    className={cn(fieldErrors.password && "border-red-500 focus-visible:ring-red-500")}
                    aria-invalid={!!fieldErrors.password}
                    aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
                  />
                  {fieldErrors.password && (
                    <p id="login-password-error" className="text-xs text-red-500" role="alert">
                      {fieldErrors.password}
                    </p>
                  )}
                </div>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-2 py-1",
                    "focus-within:ring-2 focus-within:ring-[var(--color-mid)] focus-within:ring-offset-2 focus-within:ring-offset-[var(--color-dark)] focus-within:outline-none rounded"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={loading}
                    className="h-4 w-4 shrink-0 rounded border-[var(--color-mid)] bg-[var(--color-darkest)] text-[var(--color-mid)] focus:ring-[var(--color-mid)]"
                  />
                  <span className="text-sm text-[var(--color-light)]">
                    {secureStorageAvailable ? t("login.rememberMeSecure") : t("login.rememberMe")}
                  </span>
                </label>
                <p className="text-right text-sm">
                  <Link
                    to="/forgot-password"
                    className="text-[var(--color-light)] underline hover:text-[var(--color-lightest)]"
                  >
                    {t("login.forgotPassword")}
                  </Link>
                </p>
                <motion.div whileTap={{ scale: 0.98 }} transition={{ duration: 0.1 }}>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading}
                    aria-busy={loading}
                  >
                    {loading ? (
                      <span className="inline-flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                        {t("login.signingIn")}
                      </span>
                    ) : (
                      t("login.signIn")
                    )}
                  </Button>
                </motion.div>
              </div>
            </form>
            <p className="mt-4 text-center text-sm text-[var(--color-light)]">
              {t("login.noAccount")}{" "}
              <Link
                to="/register"
                className="text-[var(--color-lightest)] underline hover:no-underline"
              >
                {t("login.registerLink")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
      </div>
    </div>
  );
}
