import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, FlaskConical, Monitor, MonitorSmartphone } from "lucide-react";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { PROTOTYPE_GROUPS } from "@/components/sandbox/prototypes/catalog";
import { cn } from "@/lib/utils";
import { springSoft } from "@/lib/animations";

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

function PrototypeGroupSection({ group }: { group: (typeof PROTOTYPE_GROUPS)[number] }) {
  const [active, setActive] = useState(group.items[0].id);
  const item = group.items.find((i) => i.id === active) ?? group.items[0];
  return (
    <section className="flex flex-col gap-4">
      <header>
        <h2 className="text-base font-bold text-[var(--color-lightest)] md:text-lg">
          {group.title}
        </h2>
      </header>

      <div
        role="tablist"
        className="flex items-end gap-1 overflow-x-auto border-b border-[var(--color-mid)]/20 pb-px"
      >
        {group.items.map((it) => (
          <button
            key={it.id}
            type="button"
            role="tab"
            aria-selected={active === it.id}
            onClick={() => setActive(it.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 text-xs font-semibold transition-colors",
              active === it.id
                ? "border-[var(--btn-gradient-start)] bg-[var(--btn-gradient-start)]/10 text-[var(--color-lightest)]"
                : "border-transparent text-[var(--color-light)] hover:text-[var(--color-lightest)]"
            )}
          >
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold",
                active === it.id
                  ? "bg-[var(--btn-gradient-start)] text-white"
                  : "bg-[var(--color-mid)]/25 text-[var(--color-light)]"
              )}
            >
              {it.label}
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={springSoft}
          className="flex min-w-0 flex-col gap-3"
        >
          <PreviewFrame>{item.node}</PreviewFrame>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

export function Sandbox() {
  const pageTitleContext = usePageTitle();

  useEffect(() => {
    pageTitleContext?.setPageTitle("UI Sandbox");
    return () => pageTitleContext?.setPageTitle(null);
  }, [pageTitleContext]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--btn-gradient-start)]/15 text-[var(--btn-gradient-start)]">
            <FlaskConical className="size-5" aria-hidden />
          </span>
          <h1 className="text-xl font-bold text-[var(--color-lightest)]">UI Sandbox</h1>
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-400">
            Admin only · Prototypes
          </span>
        </div>
        <p className="max-w-3xl text-sm leading-relaxed text-[var(--color-light)]">
          Live interactive prototypes exploring how high-grade media-logging &amp; statistics
          products (AniList, Trakt, The StoryGraph, Letterboxd, GitHub) handle key screens and
          workflows. Each demo can be inspected in desktop or mobile frames.
        </p>
      </header>

      <div className="flex flex-col gap-4">
        {PROTOTYPE_GROUPS.map((group) => {
          const open = openGroups[group.key] ?? false;
          return (
            <div
              key={group.key}
              className="rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40 p-1.5"
            >
              <button
                type="button"
                onClick={() => setOpenGroups((prev) => ({ ...prev, [group.key]: !open }))}
                aria-expanded={open}
                className="flex w-full items-center gap-2 px-2 py-2 text-left transition-colors hover:bg-[var(--color-mid)]/10 focus:outline-none max-md:min-h-[44px]"
              >
                {open ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--color-light)]" aria-hidden />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 rotate-[-90deg] text-[var(--color-light)]" aria-hidden />
                )}
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-light)]">
                  {group.title}
                </span>
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
                    <div className="mt-1 px-1 pb-1.5 pt-0.5">
                      <PrototypeGroupSection group={group} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}