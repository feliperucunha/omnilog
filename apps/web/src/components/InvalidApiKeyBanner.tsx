import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { useInvalidApiKey } from "@/contexts/InvalidApiKeyContext";
import { useMe } from "@/contexts/MeContext";
import { API_KEY_META } from "@/lib/apiKeyMeta";
import { useLocale } from "@/contexts/LocaleContext";
import { isDisableApiKeyRequirements } from "@/lib/featureFlags";

export function InvalidApiKeyBanner() {
  const { t } = useLocale();
  const { me } = useMe();
  const { invalidProviders, clearInvalidKeys } = useInvalidApiKey();

  if (isDisableApiKeyRequirements(me)) return null;
  if (invalidProviders.length === 0) return null;

  const names = invalidProviders
    .map((p) => API_KEY_META[p as keyof typeof API_KEY_META]?.name ?? p)
    .filter(Boolean);
  const message =
    names.length === 1
      ? t("apiKeyBanner.invalidKeyMessage", { name: names[0] })
      : t("apiKeyBanner.invalidKeyMessageMultiple", { names: names.join(", ") });

  return (
    <Link
      to="/settings?open=api-keys"
      onClick={clearInvalidKeys}
      className="flex min-w-0 items-center gap-3 rounded-lg border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3 text-left no-underline transition-colors text-[var(--color-warning-text)] hover:border-[var(--color-warning-hover-border)] hover:bg-[var(--color-warning-hover-bg)]"
    >
      <AlertTriangle
        className="h-5 w-5 flex-shrink-0 text-[var(--color-warning-icon)]"
        aria-hidden
      />
      <p className="min-w-0 flex-1 text-sm font-medium text-[var(--color-warning-text)]">
        {message}
      </p>
      <span className="shrink-0 text-xs font-medium text-[var(--color-warning-text-muted)]">
        {t("apiKeyBanner.invalidKeyOpenSettings")} →
      </span>
    </Link>
  );
}
