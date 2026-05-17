import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogDateFields } from "@/components/LogDateFields";
import { useLocale } from "@/contexts/LocaleContext";

export function ReadingProgressFields({
  pagesRead,
  onPagesReadChange,
  pagesCount,
  startedAt,
  onStartedAtChange,
  completedAt,
  onCompletedAtChange,
  disabled,
}: {
  pagesRead: number | "";
  onPagesReadChange: (v: number | "") => void;
  pagesCount?: number | null;
  startedAt: string;
  onStartedAtChange: (v: string) => void;
  completedAt: string;
  onCompletedAtChange: (v: string) => void;
  disabled?: boolean;
}) {
  const { t } = useLocale();
  const totalHint =
    typeof pagesCount === "number" && pagesCount > 0
      ? t("readingProgress.ofPages", { count: String(pagesCount) })
      : null;

  return (
    <div className="flex flex-col gap-4">
      <LogDateFields
        startedAt={startedAt}
        onStartedAtChange={onStartedAtChange}
        completedAt={completedAt}
        onCompletedAtChange={onCompletedAtChange}
        disabled={disabled}
      />
      <div className="space-y-2">
        <Label className="text-sm text-[var(--color-lightest)]">{t("readingProgress.pagesRead")}</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="number"
            min={0}
            step={1}
            placeholder="—"
            value={pagesRead === "" ? "" : pagesRead}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "") onPagesReadChange("");
              else {
                const n = parseInt(v, 10);
                if (Number.isFinite(n) && n >= 0) onPagesReadChange(n);
              }
            }}
            disabled={disabled}
            className="w-full max-w-[8rem]"
            aria-label={t("readingProgress.pagesRead")}
          />
          {totalHint && <span className="text-sm text-[var(--color-light)]">{totalHint}</span>}
        </div>
      </div>
    </div>
  );
}
