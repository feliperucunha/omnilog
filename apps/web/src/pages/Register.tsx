import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/PasswordInput";
import { useLocale } from "@/contexts/LocaleContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import type { AuthResponse } from "@logeverything/shared";
import { modalContentVariants } from "@/lib/animations";

export function Register() {
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error(t("toast.emailPasswordRequired"));
      return;
    }
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
      const data = await apiFetch<AuthResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      login(data.token, { ...data.user, onboarded: data.user.onboarded ?? false });
      toast.success(t("toast.accountCreated"));
      navigate(data.user.onboarded ? "/" : "/onboarding", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.registrationFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-[var(--color-darkest)] p-4"
    >
      <motion.div
        initial="initial"
        animate="animate"
        variants={modalContentVariants}
        className="w-full max-w-[400px]"
      >
        <Card className="w-full border-[var(--color-dark)] bg-[var(--color-dark)] shadow-[var(--shadow-modal)]">
          <CardHeader className="text-center">
            <h1 className="text-2xl font-bold text-[var(--color-lightest)]">
              {t("register.title")}
            </h1>
          </CardHeader>
          <CardContent className="pt-0">
            <form onSubmit={handleSubmit}>
              <div className="flex flex-col gap-4">
                <div className="space-y-2">
                  <Label>{t("register.email")}</Label>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder={t("common.placeholderEmail")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("register.password")}</Label>
                  <PasswordInput
                    autoComplete="new-password"
                    placeholder={t("common.placeholderPasswordRegister")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("register.confirmPassword")}</Label>
                  <PasswordInput
                    autoComplete="new-password"
                    placeholder={t("common.placeholderPasswordRegister")}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                <motion.div whileTap={{ scale: 0.98 }} transition={{ duration: 0.1 }}>
                  <Button
                    type="submit"
                    className="w-full bg-[var(--color-mid)] hover:bg-[var(--color-light)]"
                    disabled={loading}
                  >
                    {loading ? t("register.creatingAccount") : t("register.register")}
                  </Button>
                </motion.div>
              </div>
            </form>
            <p className="mt-4 text-center text-sm text-[var(--color-light)]">
              {t("register.haveAccount")}{" "}
              <Link
                to="/login"
                className="text-[var(--color-lightest)] underline hover:no-underline"
              >
                {t("register.signInLink")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
