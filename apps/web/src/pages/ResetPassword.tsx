import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/PasswordInput";
import { useLocale } from "@/contexts/LocaleContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { apiFetch, ApiValidationError } from "@/lib/api";
import type { AuthResponse } from "@dogument/shared";
import { modalContentVariants } from "@/lib/animations";
import { cn } from "@/lib/utils";

type ResetFieldErrors = Partial<Record<"password" | "confirmPassword", string>>;

export function ResetPassword() {
  const { t } = useLocale();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ResetFieldErrors>({});

  useEffect(() => {
    if (!token) setError(t("resetPassword.invalidToken"));
  }, [token, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    const errors: ResetFieldErrors = {};
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    if (password.length < 8 || !hasLetter || !hasNumber) {
      errors.password = t("validation.passwordLettersAndNumbers");
    }
    if (password !== confirmPassword) {
      errors.confirmPassword = t("register.passwordsDoNotMatch");
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error(errors.password ?? errors.confirmPassword);
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<AuthResponse>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      await login(data.token, { ...data.user, onboarded: data.user.onboarded ?? true });
      toast.success(t("resetPassword.success"));
      navigate(data.user.onboarded ? "/" : "/onboarding", { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : t("resetPassword.invalidToken");
      if (err instanceof ApiValidationError && Object.keys(err.fieldErrors).length > 0) {
        setFieldErrors(
          ["password", "confirmPassword"].reduce(
            (acc, k) => (err.fieldErrors[k] ? { ...acc, [k]: err.fieldErrors[k] } : acc),
            {} as ResetFieldErrors
          )
        );
      } else {
        setFieldErrors({ password: message, confirmPassword: message });
      }
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-darkest)] p-4">
        <motion.div
          initial="initial"
          animate="animate"
          variants={modalContentVariants}
          className="w-full max-w-[400px]"
        >
          <Card className="w-full border-[var(--color-surface-border)] bg-[var(--color-dark)] shadow-[var(--shadow-modal)]">
            <CardContent className="pt-6">
              <p className="text-sm text-[var(--color-light)]">{error}</p>
              <Button
                className="mt-4 w-full"
                onClick={() => navigate("/forgot-password", { replace: true })}
              >
                {t("forgotPassword.title")}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-darkest)] p-4">
      <motion.div
        initial="initial"
        animate="animate"
        variants={modalContentVariants}
        className="w-full max-w-[400px]"
      >
        <Card className="w-full border-[var(--color-surface-border)] bg-[var(--color-dark)] shadow-[var(--shadow-modal)]">
          <CardHeader className="text-center">
            <h1 className="text-2xl font-bold text-[var(--color-lightest)]">
              {t("resetPassword.title")}
            </h1>
          </CardHeader>
          <CardContent className="pt-0">
            <form onSubmit={handleSubmit}>
              <div className="flex flex-col gap-4">
                <div className="space-y-2">
                  <Label>{t("resetPassword.password")}</Label>
                  <PasswordInput
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: undefined })); }}
                    placeholder={t("common.placeholderPasswordRegister")}
                    autoComplete="new-password"
                    minLength={8}
                    required
                    className={cn(fieldErrors.password && "border-red-500 focus-visible:ring-red-500")}
                    aria-invalid={!!fieldErrors.password}
                    aria-describedby={fieldErrors.password ? "reset-password-error" : undefined}
                  />
                  {fieldErrors.password && (
                    <p id="reset-password-error" className="text-xs text-red-500" role="alert">
                      {fieldErrors.password}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>{t("resetPassword.confirmPassword")}</Label>
                  <PasswordInput
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors((p) => ({ ...p, confirmPassword: undefined })); }}
                    placeholder={t("common.placeholderPasswordRegister")}
                    autoComplete="new-password"
                    minLength={8}
                    required
                    className={cn(fieldErrors.confirmPassword && "border-red-500 focus-visible:ring-red-500")}
                    aria-invalid={!!fieldErrors.confirmPassword}
                    aria-describedby={fieldErrors.confirmPassword ? "reset-confirmPassword-error" : undefined}
                  />
                  {fieldErrors.confirmPassword && (
                    <p id="reset-confirmPassword-error" className="text-xs text-red-500" role="alert">
                      {fieldErrors.confirmPassword}
                    </p>
                  )}
                </div>
                {error && (
                  <p className="text-sm text-red-400" role="alert">{error}</p>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? t("resetPassword.submitting") : t("resetPassword.submit")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
