import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocale } from "@/contexts/LocaleContext";

export function LogDateFields({
  startedAt,
  onStartedAtChange,
  completedAt,
  onCompletedAtChange,
  disabled,
}: {
  startedAt: string;
  onStartedAtChange: (v: string) => void;
  completedAt: string;
  onCompletedAtChange: (v: string) => void;
  disabled?: boolean;
}) {
  const { t } = useLocale();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label className="text-sm text-[var(--color-lightest)]">{t("readingProgress.startedAt")}</Label>
        <Input
          type="date"
          value={startedAt}
          onChange={(e) => onStartedAtChange(e.target.value)}
          disabled={disabled}
          className="w-full"
          aria-label={t("readingProgress.startedAt")}
        />
      </div>
      <div className="space-y-2">
        <Label className="text-sm text-[var(--color-lightest)]">{t("readingProgress.finishedAt")}</Label>
        <Input
          type="date"
          value={completedAt}
          onChange={(e) => onCompletedAtChange(e.target.value)}
          disabled={disabled}
          className="w-full"
          aria-label={t("readingProgress.finishedAt")}
        />
      </div>
    </div>
  );
}
