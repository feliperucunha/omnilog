import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";

export function AuthSigningOverlay() {
  const { signingOut } = useAuth();
  const { t } = useLocale();

  if (!signingOut) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-3 bg-[var(--color-darkest)]/80 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-10 w-10 animate-spin text-[var(--btn-gradient-start)]" aria-hidden />
      <p className="text-sm font-medium text-[var(--color-lightest)]">{t("nav.signingOut")}</p>
    </div>
  );
}
