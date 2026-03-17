import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
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
import { cn } from "@/lib/utils";
import * as storage from "@/lib/storage";
import type { AuthResponse } from "@dogument/shared";
import { modalContentVariants } from "@/lib/animations";

const REMEMBER_LOGIN_KEY = "dogument-remember-login";

type LoginFieldErrors = Partial<Record<"email" | "password", string>>;

export function Login() {
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const { login } = useAuth();
  const navigate = useNavigate();

  /** Load remember-me from persistent storage (works on Android/Capacitor). */
  useEffect(() => {
    let cancelled = false;
    storage.getItem(REMEMBER_LOGIN_KEY).then((raw) => {
      if (cancelled) return;
      try {
        if (!raw) return;
        const data = JSON.parse(raw) as { email?: string } | null;
        const parsedEmail = typeof data?.email === "string" ? data.email : "";
        setEmail(parsedEmail);
        setRememberMe(!!parsedEmail);
      } catch {
        // ignore
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const clearFieldError = (field: keyof LoginFieldErrors) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
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
        void storage.setItem(
          REMEMBER_LOGIN_KEY,
          JSON.stringify({ email: email.trim() })
        );
      } else {
        void storage.removeItem(REMEMBER_LOGIN_KEY);
      }
      await login(data.token, { ...data.user, onboarded: data.user.onboarded ?? true });
      toast.success(t("toast.welcomeBack"));
      navigate(data.user.onboarded ? "/" : "/onboarding", { replace: true });
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
            <h1 className="flex flex-col gap-0.5 text-2xl -mt-6 font-bold text-[var(--color-lightest)]">
              <span>{t("app.name")}</span>
              <span className="text-lg font-normal text-[var(--color-light)]">
                {t("app.subtitle")}
              </span>
            </h1>
          </CardHeader>
          <CardContent className="pt-0">
            <form onSubmit={handleSubmit}>
              <div className="flex flex-col gap-4">
                <div className="space-y-2">
                  <Label>{t("login.emailOrUsername")}</Label>
                  <Input
                    type="text"
                    autoComplete="username"
                    placeholder={t("login.emailOrUsername")}
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); clearFieldError("email"); }}
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
                    className="h-4 w-4 shrink-0 rounded border-[var(--color-mid)] bg-[var(--color-darkest)] text-[var(--color-mid)] focus:ring-[var(--color-mid)]"
                  />
                  <span className="text-sm text-[var(--color-light)]">
                    {t("login.rememberMe")}
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
                  >
                    {loading ? t("login.signingIn") : t("login.signIn")}
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
