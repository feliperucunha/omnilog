import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/PasswordInput";
import { useLocale } from "@/contexts/LocaleContext";
import { useAuth } from "@/contexts/AuthContext";
import { COOKIE_SESSION } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import type { AuthResponse } from "@logeverything/shared";
import { modalContentVariants } from "@/lib/animations";

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

  useEffect(() => {
    if (!token) setError(t("resetPassword.invalidToken"));
  }, [token, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      toast.error(t("toast.passwordMinLength"));
      return;
    }
    if (password !== confirmPassword) {
      toast.error(t("register.passwordsDoNotMatch"));
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<AuthResponse>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      login(COOKIE_SESSION, { ...data.user, onboarded: data.user.onboarded ?? true });
      toast.success(t("resetPassword.success"));
      navigate(data.user.onboarded ? "/" : "/onboarding", { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : t("resetPassword.invalidToken");
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
          <Card className="w-full border-[var(--color-dark)] bg-[var(--color-dark)] shadow-[var(--shadow-modal)]">
            <CardContent className="pt-6">
              <p className="text-sm text-[var(--color-light)]">{error}</p>
              <Button
                className="mt-4 w-full bg-[var(--color-mid)] hover:bg-[var(--color-light)]"
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
        <Card className="w-full border-[var(--color-dark)] bg-[var(--color-dark)] shadow-[var(--shadow-modal)]">
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
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("common.placeholderPasswordRegister")}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("resetPassword.confirmPassword")}</Label>
                  <PasswordInput
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t("common.placeholderPasswordRegister")}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>
                {error && (
                  <p className="text-sm text-red-400">{error}</p>
                )}
                <Button
                  type="submit"
                  className="w-full bg-[var(--color-mid)] hover:bg-[var(--color-light)]"
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
