import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Monitor, MonitorSmartphone, Zap } from "lucide-react";
import type { ProposalOption, ProposalTopic } from "./proposalTypes";
import { cn } from "@/lib/utils";
import { springSoft } from "@/lib/animations";
import { PREVIEWS } from "./prototypes/previews";

const EFFORT_STYLE: Record<string, string> = {
  Small: "bg-emerald-500/15 text-emerald-400",
  Medium: "bg-amber-500/15 text-amber-400",
  Large: "bg-red-500/15 text-red-400",
};

function PreviewFrame({ children }: { children: React.ReactNode }) {
  const [frame, setFrame] = useState<"desktop" | "mobile">("mobile");
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1 self-end rounded-lg border border-[var(--color-mid)]/40 p-0.5">
        <button
          type="button"
          onClick={() => setFrame("desktop")}
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[var(--color-light)]",
            frame === "desktop" && "bg-[var(--btn-gradient-start)]/20 text-[var(--color-lightest)]"
          )}
        >
          <Monitor className="size-3.5" aria-hidden /> Desktop
        </button>
        <button
          type="button"
          onClick={() => setFrame("mobile")}
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[var(--color-light)]",
            frame === "mobile" && "bg-[var(--btn-gradient-start)]/20 text-[var(--color-lightest)]"
          )}
        >
          <MonitorSmartphone className="size-3.5" aria-hidden /> Mobile
        </button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/40">
        <div
          className={cn(
            "transition-all",
            frame === "mobile"
              ? "relative mx-auto my-4 max-w-[380px] overflow-hidden rounded-[2.25rem] border-[6px] border-[var(--color-dark)] bg-[var(--color-dark)] shadow-[0_0_0_1px_var(--color-mid)]"
              : "relative"
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function Breakdown({ title, body }: { title: string; body: string }) {
  if (!body) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-light)]">
        {title}
      </span>
      <p className="text-xs leading-relaxed text-[var(--color-lightest)]">{body}</p>
    </div>
  );
}

function OptionDetails({ option }: { option: ProposalOption }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
            EFFORT_STYLE[option.effort]
          )}
        >
          <Zap className="size-3" aria-hidden /> {option.effort}
        </span>
        <p className="text-xs leading-relaxed text-[var(--color-lightest)]">{option.coreIdea}</p>
      </div>
      {option.inspiredBy.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {option.inspiredBy.map((src) => (
            <span
              key={src}
              className="rounded-full border border-[var(--color-mid)]/40 px-2 py-0.5 text-[10px] font-medium text-[var(--color-light)]"
            >
              ← {src}
            </span>
          ))}
        </div>
      )}

      <PreviewFrame>{PREVIEWS[option.id] ?? option.preview}</PreviewFrame>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between rounded-lg border border-[var(--color-mid)]/30 bg-[var(--color-dark)] px-3 py-2 text-xs font-semibold text-[var(--color-light)]"
        aria-expanded={open}
      >
        Full breakdown — desktop, mobile, changes, rationale, trade-offs
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={springSoft}>
          <ChevronDown className="size-4" aria-hidden />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springSoft}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3">
              <Breakdown title="Desktop workflow" body={option.desktop} />
              <Breakdown title="Mobile workflow" body={option.mobile} />
              <Breakdown title="What changes vs today" body={option.changes.join(" · ")} />
              <Breakdown title="Why this wins" body={option.rationale} />
              <Breakdown title="Watch out for" body={option.tradeoffs.join(" · ")} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TopicSection({ topic }: { topic: ProposalTopic }) {
  const [active, setActive] = useState(topic.options[0].id);
  const option = topic.options.find((o) => o.id === active) ?? topic.options[0];
  const Icon = topic.icon;
  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--btn-gradient-start)]/15 text-[var(--btn-gradient-start)]">
            <Icon className="size-4" aria-hidden />
          </span>
          <h2 className="text-base font-bold text-[var(--color-lightest)] md:text-lg">
            {topic.page}
          </h2>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
              topic.type === "Workflow"
                ? "bg-violet-500/15 text-violet-400"
                : "bg-[var(--color-mid)]/30 text-[var(--color-light)]"
            )}
          >
            {topic.type}
          </span>
        </div>
        <p className="text-xs text-[var(--color-light)]">
          <span className="font-semibold text-[var(--color-lightest)]">Today:</span> {topic.currentUx}
        </p>
      </header>

      <div role="tablist" className="flex items-end gap-1 overflow-x-auto border-b border-[var(--color-mid)]/20 pb-px">
        {topic.options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={active === o.id}
            onClick={() => setActive(o.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 text-xs font-semibold transition-colors",
              active === o.id
                ? "border-[var(--btn-gradient-start)] bg-[var(--btn-gradient-start)]/10 text-[var(--color-lightest)]"
                : "border-transparent text-[var(--color-light)] hover:text-[var(--color-lightest)]"
            )}
          >
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold",
                active === o.id
                  ? "bg-[var(--btn-gradient-start)] text-white"
                  : "bg-[var(--color-mid)]/25 text-[var(--color-light)]"
              )}
            >
              {o.label}
            </span>
            <span className="hidden sm:inline">{o.title}</span>
            <span className="sm:hidden">{o.title.split(" ")[0]}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={option.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={springSoft}
          className="flex flex-col gap-3"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--btn-gradient-start)]/20 text-[11px] font-bold text-[var(--btn-gradient-start)]">
              {option.label}
            </span>
            <h3 className="text-sm font-semibold text-[var(--color-lightest)]">{option.title}</h3>
            <p className="hidden text-xs text-[var(--color-light)] md:inline">— {option.tagline}</p>
          </div>
          <OptionDetails option={option} />
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

export function SandboxCatalog({ topics }: { topics: ProposalTopic[] }) {
  return (
    <div className="flex flex-col gap-10">
      {topics.map((topic) => (
        <TopicSection key={topic.id} topic={topic} />
      ))}
    </div>
  );
}
