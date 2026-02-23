import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocale } from "@/contexts/LocaleContext";

interface PasswordInputProps extends Omit<React.ComponentProps<typeof Input>, "type"> {
  /** Optional label id for accessibility */
  id?: string;
}

export function PasswordInput({ className, id, ...props }: PasswordInputProps) {
  const { t } = useLocale();
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        className={cn("pr-10", className)}
        {...props}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-0 top-0 h-full rounded-l-none border-l border-[var(--color-mid)] bg-transparent px-3 text-[var(--color-light)] hover:bg-[var(--color-darkest)] hover:text-[var(--color-lightest)]"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? t("common.hidePassword") : t("common.showPassword")}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
    </div>
  );
}
