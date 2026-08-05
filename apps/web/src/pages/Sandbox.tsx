import { useEffect } from "react";
import { FlaskConical } from "lucide-react";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { SandboxCatalog } from "@/components/sandbox/SandboxCatalog";
import { section1 } from "@/components/sandbox/proposals/section1";
import { section2 } from "@/components/sandbox/proposals/section2";
import { section3 } from "@/components/sandbox/proposals/section3";
import { section4 } from "@/components/sandbox/proposals/section4";
import { section5 } from "@/components/sandbox/proposals/section5";

export function Sandbox() {
  const pageTitleContext = usePageTitle();

  useEffect(() => {
    pageTitleContext?.setPageTitle("UI Sandbox");
    return () => pageTitleContext?.setPageTitle(null);
  }, [pageTitleContext]);

  const topics = [...section1, ...section2, ...section3, ...section4, ...section5];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--btn-gradient-start)]/15 text-[var(--btn-gradient-start)]">
            <FlaskConical className="size-5" aria-hidden />
          </span>
          <h1 className="text-xl font-bold text-[var(--color-lightest)]">UI Sandbox — proposal catalog</h1>
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-400">
            Admin only · Prototypes
          </span>
        </div>
        <p className="max-w-3xl text-sm leading-relaxed text-[var(--color-light)]">
          Three thoroughly worked options for every page and for the key workflows in the app,
          inspired by how high-grade media-logging &amp; statistics products (AniList, Trakt, The
          StoryGraph, Letterboxd, GitHub) handle the same jobs. Each option explains the{" "}
          <span className="font-semibold text-[var(--color-lightest)]">desktop and mobile</span>{" "}
          workflows, what changes versus today, the rationale, and the trade-offs — so you can pick
          a direction before any code lands. Options with a{" "}
          <span className="font-semibold text-[var(--color-lightest)]">live preview</span> are
          interactive; the rest show a layout wireframe.
        </p>
      </header>

      <SandboxCatalog topics={topics} />
    </div>
  );
}
