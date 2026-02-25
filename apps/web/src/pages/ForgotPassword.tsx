import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocale } from "@/contexts/LocaleContext";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { modalContentVariants } from "@/lib/animations";

export function ForgotPassword() {
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error(t("toast.emailPasswordRequired"));
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setSent(true);
      toast.success(t("forgotPassword.success"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.loginFailed"));
    } finally {
      setLoading(false);
    }
  };

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
              {t("forgotPassword.title")}
            </h1>
            <p className="mt-2 text-sm text-[var(--color-light)]">
              {t("forgotPassword.intro")}
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            {sent ? (
              <div className="space-y-4">
                <p className="text-sm text-[var(--color-light)]">
                  {t("forgotPassword.success")}
                </p>
                <Button asChild className="w-full">
                  <Link to="/login">{t("forgotPassword.backToLogin")}</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="flex flex-col gap-4">
                  <div className="space-y-2">
                    <Label>{t("forgotPassword.email")}</Label>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder={t("common.placeholderEmail")}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? t("forgotPassword.sending") : t("forgotPassword.submit")}
                  </Button>
                </div>
              </form>
            )}
            <p className="mt-4 text-center text-sm text-[var(--color-light)]">
              <Link
                to="/login"
                className="text-[var(--color-lightest)] underline hover:no-underline"
              >
                {t("forgotPassword.backToLogin")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
