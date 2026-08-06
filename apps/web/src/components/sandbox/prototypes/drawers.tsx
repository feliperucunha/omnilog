import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Pencil, X } from "lucide-react";
import { springSoft } from "@/lib/animations";
import { cn } from "@/lib/utils";
import { DEMO_ITEMS, MEDIA_META, type DemoItem } from "../sandboxData";
import { Chip, Cover, SectionLabel, StarsInput } from "./kit";

type Draft = { status: string; progress: number; rating: number };

const STATUS_OPTIONS = ["Backlog", "In progress", "Completed", "Dropped"];

const INITIAL_DRAFT: Draft = { status: "In progress", progress: 40, rating: 3 };

function itemForDraft(it: DemoItem) {
  return {
    title: it.title,
    meta: `${MEDIA_META[it.mediaType].label} · ${it.logs} logs`,
  };
}

function GrabHandle() {
  return <div className="mx-auto h-1 w-10 rounded-full bg-[var(--color-mid)]" />;
}

function DraftFields({
  draft,
  onChange,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
}) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <SectionLabel>Status</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map((s) => (
            <Chip key={s} active={draft.status === s} onClick={() => onChange({ ...draft, status: s })}>
              {s}
            </Chip>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <SectionLabel>Progress</SectionLabel>
          <span className="text-[11px] font-bold tabular-nums text-[var(--color-lightest)]">
            {draft.progress}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={draft.progress}
          onChange={(e) => onChange({ ...draft, progress: Number(e.target.value) })}
          className="accent-[var(--btn-gradient-start)]"
        />
      </div>

      <div className="flex items-center justify-between">
        <SectionLabel>Rating</SectionLabel>
        <StarsInput value={draft.rating} onChange={(rating) => onChange({ ...draft, rating })} />
      </div>
    </>
  );
}

function DrawerChrome({
  title,
  subtitle,
  onClose,
  children,
  footer,
  className,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={springSoft}
      className={cn(
        "absolute inset-x-0 bottom-0 z-20 flex flex-col overflow-hidden rounded-t-2xl border-t border-[var(--color-mid)]/30 bg-[var(--color-dark)]",
        className
      )}
    >
      <div className="pt-2">
        <GrabHandle />
      </div>
      <div className="flex items-start gap-2 px-4 pt-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[var(--color-lightest)]">{title}</p>
          <p className="truncate text-[10px] text-[var(--color-light)]">{subtitle}</p>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--color-mid)]/30 text-[var(--color-light)]"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-3">{children}</div>
      {footer && <div className="flex items-center gap-2 border-t border-[var(--color-mid)]/20 p-3">{footer}</div>}
    </motion.div>
  );
}

function Backdrop({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      type="button"
      aria-label="Close"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClick}
      className="absolute inset-0 z-10 bg-black/50"
    />
  );
}

function SavedToast({ label, onUndo }: { label: string; onUndo?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={springSoft}
      className="absolute inset-x-4 bottom-4 z-30 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] font-semibold text-emerald-300"
    >
      <Check className="size-4" aria-hidden /> {label}
      {onUndo && (
        <button type="button" onClick={onUndo} className="ml-auto rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-200">
          Undo
        </button>
      )}
    </motion.div>
  );
}

function MiniRow({
  it,
  onEdit,
  status,
}: {
  it: DemoItem;
  onEdit: () => void;
  status: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40 p-2">
      <Cover item={it} className="aspect-square w-10 rounded-md [&_span]:hidden" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-[var(--color-lightest)]">{it.title}</p>
        <p className="text-[10px] text-[var(--color-light)]">
          {MEDIA_META[it.mediaType].label} · {status}
        </p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${it.title}`}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-mid)]/40 text-[var(--color-light)]"
      >
        <Pencil className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

/* ================================================================== */
/* VERSION A — "Snapped sheet"                                         */
/* Full-height (88%) bottom sheet with a sticky header, one scrollable */
/* field surface and a pinned Cancel / Save footer. Refines the current */
/* mobile LogForm drawer.                                              */
/* ================================================================== */

export function DrawerSnapped() {
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState<DemoItem | null>(null);
  const [draft, setDraft] = useState<Draft>(INITIAL_DRAFT);
  const [saved, setSaved] = useState(false);

  const openFor = (it: DemoItem) => {
    setItem(it);
    setDraft(INITIAL_DRAFT);
    setOpen(true);
  };

  return (
    <div className="relative flex min-h-[28rem] flex-col gap-2 bg-[var(--color-dark)] p-4">
      <p className="text-sm font-bold text-[var(--color-lightest)]">Watching</p>
      {DEMO_ITEMS.slice(0, 4).map((it) => (
        <MiniRow key={it.id} it={it} status="In progress" onEdit={() => openFor(it)} />
      ))}

      <AnimatePresence>
        {open && item && (
          <>
            <Backdrop onClick={() => setOpen(false)} />
            <DrawerChrome
              title={itemForDraft(item).title}
              subtitle={itemForDraft(item).meta}
              onClose={() => setOpen(false)}
              className="h-[88%]"
              footer={
                <>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex-1 rounded-xl border border-[var(--color-mid)]/40 py-2.5 text-xs font-semibold text-[var(--color-light)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setSaved(true);
                      setTimeout(() => setSaved(false), 1800);
                    }}
                    className="btn-gradient flex-[2] rounded-xl py-2.5 text-xs font-bold text-white"
                  >
                    Save changes
                  </button>
                </>
              }
            >
              <DraftFields draft={draft} onChange={setDraft} />
              <div className="flex flex-col gap-1.5">
                <SectionLabel>Notes</SectionLabel>
                <div className="h-24 rounded-xl border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/40 p-3 text-[11px] text-[var(--color-light)]">
                  Episode 4 felt like a bottle episode — pacing off, but the payoff…
                </div>
              </div>
            </DrawerChrome>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>{saved && <SavedToast label="Saved" />}</AnimatePresence>
    </div>
  );
}

/* ================================================================== */
/* VERSION B — "Steps drawer"                                          */
/* A shorter (62%) drawer that edits one concern at a time behind a    */
/* segmented progress bar. Light, single-thumb, ends with a save.      */
/* ================================================================== */

const STEPS = [
  { t: "Status", desc: "Where is it at?" },
  { t: "Progress", desc: "How far along?" },
  { t: "Rating", desc: "How did it land?" },
] as const;

export function DrawerSteps() {
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState<DemoItem | null>(null);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(INITIAL_DRAFT);
  const [saved, setSaved] = useState(false);

  const openFor = (it: DemoItem) => {
    setItem(it);
    setStep(0);
    setDraft(INITIAL_DRAFT);
    setOpen(true);
  };

  return (
    <div className="relative flex min-h-[28rem] flex-col gap-2 bg-[var(--color-dark)] p-4">
      <p className="text-sm font-bold text-[var(--color-lightest)]">Watching</p>
      {DEMO_ITEMS.slice(4, 7).map((it) => (
        <MiniRow key={it.id} it={it} status="In progress" onEdit={() => openFor(it)} />
      ))}

      <AnimatePresence>
        {open && item && (
          <>
            <Backdrop onClick={() => setOpen(false)} />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={springSoft}
              className="absolute inset-x-0 bottom-0 z-20 flex h-[62%] flex-col overflow-hidden rounded-t-2xl border-t border-[var(--color-mid)]/30 bg-[var(--color-dark)]"
            >
              <div className="pt-2">
                <GrabHandle />
              </div>
              <div className="flex items-center justify-between px-4 pt-2">
                <p className="truncate text-sm font-bold text-[var(--color-lightest)]">
                  {itemForDraft(item).title}
                </p>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--color-mid)]/30 text-[var(--color-light)]"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>

              <div className="flex gap-1 px-4 pt-3">
                {STEPS.map((s, i) => (
                  <span
                    key={s.t}
                    className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-[var(--btn-gradient-start)]" : "bg-[var(--color-mid)]/30")}
                  />
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={springSoft}
                  className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3"
                >
                  <p className="text-sm font-black text-[var(--color-lightest)]">{STEPS[step].t}</p>
                  <p className="text-[11px] text-[var(--color-light)]">{STEPS[step].desc}</p>
                  {step === 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {STATUS_OPTIONS.map((s) => (
                        <Chip key={s} active={draft.status === s} onClick={() => setDraft({ ...draft, status: s })}>
                          {s}
                        </Chip>
                      ))}
                    </div>
                  )}
                  {step === 1 && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[var(--color-light)]">Progress</span>
                        <span className="font-bold tabular-nums text-[var(--color-lightest)]">{draft.progress}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={draft.progress}
                        onChange={(e) => setDraft({ ...draft, progress: Number(e.target.value) })}
                        className="accent-[var(--btn-gradient-start)]"
                      />
                    </div>
                  )}
                  {step === 2 && (
                    <div className="flex items-center justify-between rounded-xl bg-[var(--color-darkest)]/50 p-3">
                      <span className="text-[11px] text-[var(--color-light)]">Your rating</span>
                      <StarsInput value={draft.rating} onChange={(rating) => setDraft({ ...draft, rating })} />
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              <div className="flex items-center gap-2 border-t border-[var(--color-mid)]/20 p-3">
                {step > 0 && (
                  <button
                    type="button"
                    onClick={() => setStep((s) => s - 1)}
                    className="flex h-10 items-center gap-1 rounded-xl border border-[var(--color-mid)]/40 px-3 text-xs font-semibold text-[var(--color-light)]"
                  >
                    <ChevronLeft className="size-4" aria-hidden /> Back
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (step < STEPS.length - 1) setStep((s) => s + 1);
                    else {
                      setOpen(false);
                      setSaved(true);
                      setTimeout(() => setSaved(false), 1800);
                    }
                  }}
                  className="btn-gradient flex flex-1 items-center justify-center gap-1 rounded-xl py-2.5 text-xs font-bold text-white"
                >
                  {step === STEPS.length - 1 ? (
                    <>
                      <Check className="size-4" aria-hidden /> Save
                    </>
                  ) : (
                    <>
                      Next <ChevronRight className="size-4" aria-hidden />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>{saved && <SavedToast label="Saved" />}</AnimatePresence>
    </div>
  );
}

/* ================================================================== */
/* VERSION C — "Floating card"                                         */
/* A compact, almost full-bleed floating card (not full-width) that    */
/* keeps the library visible behind a soft blur. Quick edits only.     */
/* ================================================================== */

export function DrawerFloat() {
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState<DemoItem | null>(null);
  const [draft, setDraft] = useState<Draft>(INITIAL_DRAFT);
  const [saved, setSaved] = useState(false);
  const [prev, setPrev] = useState<Draft>(INITIAL_DRAFT);

  const openFor = (it: DemoItem) => {
    setItem(it);
    setPrev(INITIAL_DRAFT);
    setDraft(INITIAL_DRAFT);
    setOpen(true);
  };

  const undo = () => {
    setDraft(prev);
    setSaved(false);
  };

  return (
    <div className="relative flex min-h-[28rem] flex-col gap-2 bg-[var(--color-dark)] p-4">
      <p className="text-sm font-bold text-[var(--color-lightest)]">Watching</p>
      {DEMO_ITEMS.slice(1, 5).map((it) => (
        <MiniRow key={it.id} it={it} status="In progress" onEdit={() => openFor(it)} />
      ))}

      <AnimatePresence>
        {open && item && (
          <>
            <motion.button
              type="button"
              aria-label="Close"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="absolute inset-0 z-10 bg-black/30 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ y: "calc(100% + 16px)" }}
              animate={{ y: 0 }}
              exit={{ y: "calc(100% + 16px)" }}
              transition={springSoft}
              className="absolute inset-x-3 bottom-3 z-20 flex flex-col gap-3 rounded-2xl border border-[var(--color-mid)]/30 bg-[var(--color-dark)] p-3 shadow-xl"
            >
              <div className="flex items-center gap-2">
                <Cover item={item} className="aspect-square w-9 rounded-md [&_span]:hidden" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-[var(--color-lightest)]">{item.title}</p>
                  <p className="truncate text-[10px] text-[var(--color-light)]">{itemForDraft(item).meta}</p>
                </div>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--color-mid)]/30 text-[var(--color-light)]"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>

              <div className="flex flex-col gap-2.5">
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_OPTIONS.slice(0, 3).map((s) => (
                    <Chip key={s} active={draft.status === s} onClick={() => setDraft({ ...draft, status: s })}>
                      {s}
                    </Chip>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <StarsInput value={draft.rating} onChange={(rating) => setDraft({ ...draft, rating })} />
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={draft.progress}
                      onChange={(e) => setDraft({ ...draft, progress: Number(e.target.value) })}
                      className="min-w-0 flex-1 accent-[var(--btn-gradient-start)]"
                    />
                    <span className="w-8 text-right text-[10px] font-bold tabular-nums text-[var(--color-lightest)]">
                      {draft.progress}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl border border-[var(--color-mid)]/40 py-2.5 text-xs font-semibold text-[var(--color-light)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setSaved(true);
                    setTimeout(() => setSaved(false), 1800);
                  }}
                  className="btn-gradient flex-[2] rounded-xl py-2.5 text-xs font-bold text-white"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {saved && <SavedToast label={`Updated ${item?.title ?? ""}`} onUndo={undo} />}
      </AnimatePresence>
    </div>
  );
}
