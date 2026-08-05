import type { ReactNode } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEMO_ITEMS, itemGradient, mediaIcon, type DemoItem } from "../sandboxData";

/** Poster-style cover placeholder derived from a demo item. */
export function Cover({
  item,
  className,
  iconClass,
}: {
  item: DemoItem;
  className?: string;
  iconClass?: string;
}) {
  const Icon = mediaIcon(item.mediaType);
  return (
    <div
      className={cn("relative flex aspect-[2/3] items-end overflow-hidden rounded-lg", className)}
      style={{ background: itemGradient(item) }}
    >
      <Icon className={cn("absolute inset-0 m-auto size-6 text-white/70", iconClass)} aria-hidden />
      <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1.5 py-1 text-[10px] font-semibold text-white">
        {item.title}
      </span>
    </div>
  );
}

/** A strip of covers, used for rails. */
export function Rail({ items, className }: { items: DemoItem[]; className?: string }) {
  return (
    <div className={cn("flex gap-2 overflow-x-auto pb-1", className)}>
      {items.map((it) => (
        <Cover key={it.id} item={it} className="min-w-[72px] w-20 shrink-0" />
      ))}
    </div>
  );
}

/** Small pill / chip (also usable as a button). */
export function Chip({
  active,
  onClick,
  children,
  className,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
        active
          ? "border-[var(--btn-gradient-start)] bg-[var(--btn-gradient-start)]/15 text-white"
          : "border-[var(--color-mid)]/50 bg-[var(--color-dark)] text-[var(--color-light)]",
        className
      )}
    >
      {children}
    </button>
  );
}

/** Horizontal progress bar. */
export function Meter({
  value,
  className,
  icon = false,
}: {
  value: number;
  className?: string;
  icon?: boolean;
}) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-mid)]/30", className)}>
      <div
        className={cn("h-full rounded-full", icon ? "btn-gradient" : "bg-[var(--btn-gradient-start)]")}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

/** Read-only star rating row. */
export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${value} stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "size-3.5",
            i < Math.round(value) ? "fill-amber-400 text-amber-400" : "text-[var(--color-mid)]"
          )}
          aria-hidden
        />
      ))}
    </span>
  );
}

/** Interactive star input. */
export function StarsInput({
  value,
  onChange,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex items-center gap-0.5", className)}>
      {Array.from({ length: 5 }).map((_, i) => (
        <button
          key={i}
          type="button"
          aria-label={`${i + 1} stars`}
          onClick={() => onChange(i + 1)}
          className="text-amber-400 transition-transform hover:scale-125"
        >
          <Star
            className={cn("size-5", i < value ? "fill-amber-400 text-amber-400" : "text-[var(--color-mid)]")}
            aria-hidden
          />
        </button>
      ))}
    </div>
  );
}

/** Section / group label. */
export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "text-[10px] font-bold uppercase tracking-wider text-[var(--color-light)]",
        className
      )}
    >
      {children}
    </p>
  );
}

/** A stat tile (label + big value + optional sub). */
export function StatTile({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl bg-[var(--color-darkest)]/50 p-3", className)}>
      <p className="text-[10px] uppercase tracking-wide text-[var(--color-light)]">{label}</p>
      <p className="mt-0.5 text-xl font-bold text-[var(--color-lightest)]">{value}</p>
      {sub && <p className="text-[10px] text-[var(--color-light)]">{sub}</p>}
    </div>
  );
}

/** Fake top navigation bar for page-style prototypes. */
export function MockTopNav({
  title = "Media Log",
  right,
}: {
  title?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-[var(--color-mid)]/20 px-3 py-2">
      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--btn-gradient-start)] text-[11px] font-bold text-white">
        ◈
      </div>
      <span className="text-xs font-bold text-[var(--color-lightest)]">{title}</span>
      <span className="hidden flex-1 items-center gap-3 text-[11px] font-medium text-[var(--color-light)] sm:flex">
        <span>Home</span>
        <span>Stats</span>
        <span>Market</span>
      </span>
      <div className="ml-auto sm:ml-0">{right}</div>
    </div>
  );
}

/** Fake mobile-first bottom dock: native 44px bottom-nav with a center '+' quick-log. */
export function MockDock({ plusLabel = "Add", onAdd }: { plusLabel?: string; onAdd?: () => void }) {
  const tabs = [
    { t: "Home", i: "▦" },
    { t: "Stats", i: "▤" },
    { t: "Market", i: "🛒" },
    { t: "Search", i: "🔍" },
  ];
  return (
    <div className="grid grid-cols-5 items-stretch gap-1 border-t border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40 px-1 py-1">
      {tabs.map((tab) => (
        <span
          key={tab.t}
          className="flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg py-1 text-[9px] text-[var(--color-light)]"
        >
          <span className="text-sm">{tab.i}</span>
          {tab.t}
        </span>
      ))}
      <button
        type="button"
        onClick={onAdd}
        aria-label={plusLabel}
        className="btn-gradient mx-auto mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl text-white"
      >
        <span className="text-lg font-black leading-none">+</span>
      </button>
    </div>
  );
}

export { DEMO_ITEMS };