import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/contexts/LocaleContext";
import { cn } from "@/lib/utils";

export function MatchesPlayedField({
  value,
  onChange,
  disabled,
  inputClassName,
}: {
  value: number | "";
  onChange: (value: number | "") => void;
  disabled?: boolean;
  inputClassName?: string;
}) {
  const { t } = useLocale();
  const addOneMatch = () => onChange((typeof value === "number" ? value : 0) + 1);

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min={0}
        step={1}
        placeholder="0"
        value={value === "" ? "" : value}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "") onChange("");
          else {
            const n = parseInt(v, 10);
            if (Number.isInteger(n) && n >= 0) onChange(n);
          }
        }}
        disabled={disabled}
        className={cn("w-full max-w-[8rem]", inputClassName)}
        aria-label={t("itemReviewForm.matchesPlayed")}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={addOneMatch}
        disabled={disabled}
        aria-label={t("itemReviewForm.addOneMatch")}
        title={t("itemReviewForm.addOneMatch")}
      >
        <Plus aria-hidden />
      </Button>
    </div>
  );
}
