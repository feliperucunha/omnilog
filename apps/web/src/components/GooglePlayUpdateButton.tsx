import { Loader2 } from "lucide-react";
import { GooglePlayIcon } from "@/components/GooglePlayIcon";
import { cn } from "@/lib/utils";

type GooglePlayUpdateButtonProps = {
  topLabel: string;
  storeLabel: string;
  loadingLabel: string;
  isLoading: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
};

export function GooglePlayUpdateButton({
  topLabel,
  storeLabel,
  loadingLabel,
  isLoading,
  disabled,
  onClick,
  className,
}: GooglePlayUpdateButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || isLoading}
      onClick={onClick}
      className={cn(
        "group relative flex w-full min-h-[3.25rem] items-center gap-3 overflow-hidden rounded-xl px-4 py-3 text-left",
        "bg-[#0d0d0d] text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)]",
        "ring-1 ring-white/12 transition-[transform,opacity,box-shadow] duration-200",
        "hover:ring-white/20 hover:shadow-[0_10px_28px_rgba(0,0,0,0.42)]",
        "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--btn-gradient-start)]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-dark)]",
        className
      )}
    >
      <span
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#00F076]/8 via-transparent to-[#4285F4]/10 opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden
      />
      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] ring-1 ring-white/10">
        {isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-white/80" aria-hidden />
        ) : (
          <GooglePlayIcon className="h-7 w-7" />
        )}
      </span>
      <span className="relative flex min-w-0 flex-1 flex-col justify-center leading-none">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/65">
          {isLoading ? loadingLabel : topLabel}
        </span>
        <span className="mt-1 truncate text-[1.05rem] font-medium tracking-tight text-white">
          {storeLabel}
        </span>
      </span>
    </button>
  );
}
