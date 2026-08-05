import { useState } from "react";
import { Star, CloudUpload, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const MOODS = ["Chill", "Epic", "Thoughtful", "Funny", "Dark", "Cozy"];

export function ConceptReviewSheet() {
  const [stars, setStars] = useState(4);
  const [moods, setMoods] = useState<string[]>(["Thoughtful"]);
  const [draft, setDraft] = useState("");
  const [autosaving, setAutosaving] = useState(false);

  const toggleMood = (m: string) => {
    setMoods((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  };

  const saveDraft = () => {
    setAutosaving(true);
    setTimeout(() => setAutosaving(false), 900);
  };

  return (
    <div className="relative flex min-h-[30rem] flex-col overflow-hidden bg-[var(--color-dark)]">
      {/* Item preview header */}
      <div className="flex items-center gap-3 p-4">
        <div
          className="flex h-16 w-12 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white/90"
          aria-hidden
        >
          <Sparkles className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-[var(--color-lightest)]">Dune: Part Two</p>
          <p className="text-[11px] text-[var(--color-light)]">Writing your review</p>
        </div>
        <div className="ml-auto flex items-center gap-1 rounded-full bg-[var(--color-mid)]/30 px-2 py-1 text-[10px] font-medium text-[var(--color-light)]">
          {autosaving ? (
            <>
              <CloudUpload className="size-3 animate-pulse" aria-hidden /> Autosaving
            </>
          ) : (
            <>Draft saved · 3s</>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* Stars + mood */}
        <div className="flex flex-col gap-3 rounded-2xl bg-[var(--color-darkest)]/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-light)]">
              Your rating
            </span>
            <span className="text-sm font-bold text-amber-400">{stars}.0 / 5</span>
          </div>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                aria-label={`${s} stars`}
                onClick={() => setStars(s)}
                className="p-0.5"
              >
                <Star
                  className={cn(
                    "size-7",
                    s <= stars ? "fill-amber-400 text-amber-400" : "text-[var(--color-light)]"
                  )}
                  aria-hidden
                />
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {MOODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => toggleMood(m)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  moods.includes(m)
                    ? "border-[var(--btn-gradient-start)] bg-[var(--btn-gradient-start)]/20 text-[var(--color-lightest)]"
                    : "border-[var(--color-mid)]/40 text-[var(--color-light)]"
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Prose */}
        <div className="flex flex-1 flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={saveDraft}
            placeholder="Share what worked, what fell flat, and who should watch…"
            className="min-h-[9rem] flex-1 resize-none rounded-2xl border border-[var(--color-mid)]/40 bg-[var(--color-darkest)]/50 p-3 text-sm text-[var(--color-lightest)] outline-none focus:border-[var(--btn-gradient-start)]"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] tabular-nums text-[var(--color-light)]">
              {draft.length} / 5000
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-xl px-3 py-2 text-xs font-semibold text-[var(--color-light)] hover:text-[var(--color-lightest)]"
              >
                Save draft
              </button>
              <button
                type="button"
                className="btn-gradient rounded-xl px-4 py-2 text-xs font-semibold"
              >
                Publish review
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}