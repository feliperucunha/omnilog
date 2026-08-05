import { useMemo } from "react";
import { Share2, Trophy, Clock3, Flame, Star, TrendingUp } from "lucide-react";
import { MiniBars, seededRand } from "./SandboxPrimitives";
import { DEMO_ITEMS, itemGradient, MEDIA_META } from "./sandboxData";

function Highlight({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Trophy;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/50 p-3">
      <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-light)]">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </span>
      <span className="text-sm font-bold text-[var(--color-lightest)]">{value}</span>
    </div>
  );
}

export function ConceptWrapUp() {
  const collage = useMemo(() => {
    const r = seededRand(31);
    return [...DEMO_ITEMS].sort(() => r() - 0.5).slice(0, 8);
  }, []);

  const months = useMemo(() => {
    const r = seededRand(15);
    return Array.from({ length: 12 }, () => Math.round(r() * 90 + 8));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-[var(--color-light)]">Your year in media</p>
          <h3 className="text-xl font-bold text-[var(--color-lightest)]">2026 Wrap-up</h3>
        </div>
        <button
          type="button"
          className="flex h-9 items-center gap-2 rounded-xl border-2 border-[var(--btn-gradient-start)] px-3 text-xs font-semibold text-[var(--color-lightest)] transition-colors hover:bg-[var(--btn-gradient-start)]/10"
        >
          <Share2 className="size-4" aria-hidden />
          Share recap
        </button>
      </div>

      {/* Cover collage */}
      <div className="grid grid-cols-4 gap-1.5">
        {collage.map((item, i) => {
          const Icon = MEDIA_META[item.mediaType].icon;
          return (
            <div
              key={item.id}
              className={`flex aspect-[2/3] items-center justify-center overflow-hidden rounded-lg ${
                i === 0 ? "col-span-2 row-span-2" : ""
              }`}
              style={{ background: itemGradient(item) }}
              title={item.title}
            >
              <Icon className="size-8 text-white/90" aria-hidden />
            </div>
          );
        })}
      </div>

      {/* Highlights */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        <Highlight icon={Trophy} label="Top genre" value="Sci-Fi · 38% of logs" />
        <Highlight icon={Clock3} label="Hours logged" value="84h across media" />
        <Highlight icon={Flame} label="Longest streak" value="12 days · March" />
        <Highlight icon={Star} label="Avg rating" value="7.8 / 10" />
        <div className="col-span-2 flex min-w-0 flex-col gap-1 rounded-xl border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/50 p-3 lg:col-span-1">
          <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-light)]">
            <TrendingUp className="size-3.5" aria-hidden />
            Busiest months
          </span>
          <div className="flex flex-1 items-end gap-1.5 pt-1">
            <MiniBars values={months} height={40} />
          </div>
        </div>
      </div>
    </div>
  );
}
