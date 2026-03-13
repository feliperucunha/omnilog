import { Logo } from "@/components/Logo";
import { Loader2 } from "lucide-react";

/** Full-screen loader used when waiting for initial data (e.g. dashboard me + counts + logs). */
export function FullPageLoader() {
  return (
    <div
      className="fixed inset-0 z-[98] flex flex-col items-center justify-center gap-8 bg-[var(--color-dark)] px-4"
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <Logo alt="" className="h-16 w-auto sm:h-20 md:h-24" />
      <Loader2 className="h-10 w-10 animate-spin text-[var(--color-mid)]" aria-hidden />
    </div>
  );
}
