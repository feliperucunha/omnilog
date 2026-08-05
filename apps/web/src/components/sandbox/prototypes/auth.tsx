import { useState } from "react";
import { KeyRound, Mail, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionLabel } from "./kit";

export function AuthSplit() {
  return (
    <div className="grid min-h-[26rem] bg-[var(--color-dark)] sm:grid-cols-2">
      <div className="hidden flex-col justify-between bg-gradient-to-br from-[var(--btn-gradient-start)]/30 to-[var(--btn-gradient-end)]/10 p-6 sm:flex">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--btn-gradient-start)] text-sm font-black text-white">◈</span>
        <div className="flex flex-col gap-2">
          <p className="text-2xl font-black leading-tight text-[var(--color-lightest)]">Log everything<br />you love.</p>
          <div className="flex flex-wrap gap-1.5 text-[10px] text-[var(--color-light)]">
            {["84k logs", "7k members", "12 types"].map((s) => (
              <span key={s} className="rounded-full bg-[var(--color-dark)]/60 px-2 py-0.5">{s}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-center gap-3 p-5 sm:p-6">
        <SectionLabel>Welcome back</SectionLabel>
        <button type="button" className="flex items-center justify-center gap-2 rounded-xl bg-[var(--color-darkest)]/60 border border-[var(--color-mid)]/30 py-2.5 text-xs font-semibold text-[var(--color-lightest)]">
          <KeyRound className="size-3.5" aria-hidden /> Continue with passkey
        </button>
        <button type="button" className="flex items-center justify-center gap-2 rounded-xl bg-[var(--color-darkest)]/60 border border-[var(--color-mid)]/30 py-2.5 text-xs font-semibold text-[var(--color-lightest)]">
          <Mail className="size-3.5" aria-hidden /> Email me a magic link
        </button>
        <div className="flex items-center gap-2 text-[9px] uppercase text-[var(--color-light)]">
          <span className="h-px flex-1 bg-[var(--color-mid)]/30" /> or <span className="h-px flex-1 bg-[var(--color-mid)]/30" />
        </div>
        <input placeholder="Email" className="rounded-xl border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/60 px-3 py-2.5 text-xs text-[var(--color-lightest)] outline-none placeholder:text-[var(--color-light)]" />
        <input type="password" placeholder="Password" className="rounded-xl border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/60 px-3 py-2.5 text-xs text-[var(--color-lightest)] outline-none placeholder:text-[var(--color-light)]" />
        <button type="button" className="btn-gradient rounded-xl py-2.5 text-sm font-bold text-white">Sign in</button>
        <p className="text-center text-[10px] text-[var(--color-light)]">No account? <span className="font-semibold text-[var(--btn-gradient-start)]">Create one</span></p>
      </div>
    </div>
  );
}

export function AuthOnboard() {
  const [step, setStep] = useState(0);
  const steps = [
    { t: "Create your account", body: (
      <div className="flex flex-col gap-2">
        <input placeholder="Name" className="rounded-xl border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/60 px-3 py-2.5 text-xs outline-none placeholder:text-[var(--color-light)]" />
        <input placeholder="Email" className="rounded-xl border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/60 px-3 py-2.5 text-xs outline-none placeholder:text-[var(--color-light)]" />
        <input type="password" placeholder="Password" className="rounded-xl border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/60 px-3 py-2.5 text-xs outline-none placeholder:text-[var(--color-light)]" />
      </div>
    ) },
    { t: "What do you love?", body: (
      <div className="flex flex-wrap gap-2">
        {["Movies", "TV", "Books", "Games", "Board games"].map((c) => (
          <span key={c} className="rounded-full border border-[var(--color-mid)]/40 bg-[var(--color-darkest)]/60 px-3 py-1.5 text-xs text-[var(--color-lightest)]">{c}</span>
        ))}
      </div>
    ) },
    { t: "Log your first item", body: (
      <div className="flex flex-col gap-2">
        <div className="rounded-xl border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/60 px-3 py-2.5 text-xs text-[var(--color-light)]">Search “dune”…</div>
        <button type="button" className="rounded-xl bg-[var(--color-darkest)]/60 border border-[var(--color-mid)]/30 px-3 py-2.5 text-left text-xs text-[var(--color-lightest)]">🎬 Dune: Part Two <span className="float-right text-[var(--btn-gradient-start)]">+ Log</span></button>
      </div>
    ) },
  ];
  return (
    <div className="flex min-h-[26rem] flex-col bg-[var(--color-dark)] p-5">
      <div className="flex gap-1">
        {steps.map((s, i) => (
          <span key={s.t} className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-[var(--btn-gradient-start)]" : "bg-[var(--color-mid)]/30")} />
        ))}
      </div>
      <p className="mt-4 text-[10px] font-bold uppercase tracking-wide text-[var(--btn-gradient-start)]">Step {step + 1} of {steps.length}</p>
      <p className="mt-1 text-xl font-black text-[var(--color-lightest)]">{steps[step].t}</p>
      <div className="mt-4 flex-1">{steps[step].body}</div>
      <div className="mt-4 flex items-center gap-2">
        {step > 0 && (
          <button type="button" onClick={() => setStep((s) => s - 1)} className="rounded-xl border border-[var(--color-mid)]/40 px-4 py-2.5 text-xs font-semibold text-[var(--color-light)]">Back</button>
        )}
        <button type="button" onClick={() => setStep((s) => Math.min(2, s + 1))} className="btn-gradient flex-1 rounded-xl py-2.5 text-sm font-bold text-white">
          {step === 2 ? "Log my first item" : "Continue"}
        </button>
      </div>
      <button type="button" className="mt-2 self-center text-[10px] text-[var(--color-light)]">Skip for now</button>
    </div>
  );
}

export function AuthBrand() {
  return (
    <div className="relative flex min-h-[26rem] items-center justify-center overflow-hidden bg-[var(--color-dark)] p-4">
      <div className="absolute inset-0 opacity-60" style={{ background: "radial-gradient(60% 60% at 30% 20%, color-mix(in srgb, #7C3AED 35%, transparent), transparent), radial-gradient(50% 50% at 80% 70%, color-mix(in srgb, #DB2777 30%, transparent), transparent)" }} />
      <div className="relative flex w-full max-w-xs flex-col gap-3 rounded-2xl border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/80 p-5">
        <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--btn-gradient-start)] text-lg font-black text-white">◈</span>
        <p className="text-center text-sm font-bold text-[var(--color-lightest)]">Welcome back</p>
        <input placeholder="Email" className="rounded-xl border border-[var(--color-mid)]/30 bg-[var(--color-dark)]/60 px-3 py-2.5 text-xs outline-none placeholder:text-[var(--color-light)]" />
        <input type="password" placeholder="Password" className="rounded-xl border border-[var(--color-mid)]/30 bg-[var(--color-dark)]/60 px-3 py-2.5 text-xs outline-none placeholder:text-[var(--color-light)]" />
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-[var(--color-light)]">Forgot password?</span>
          <span className="font-semibold text-[var(--btn-gradient-start)]">Sign in</span>
        </div>
        <button type="button" className="btn-gradient rounded-xl py-2.5 text-sm font-bold text-white">Continue</button>
        <div className="flex items-center gap-2 text-[9px] uppercase text-[var(--color-light)]"><span className="h-px flex-1 bg-[var(--color-mid)]/30" /> or <span className="h-px flex-1 bg-[var(--color-mid)]/30" /></div>
        <div className="flex items-center justify-center gap-2 text-[10px] text-[var(--color-light)]"><Sparkles className="size-3.5 text-[var(--btn-gradient-start)]" aria-hidden /> <span>Continue with a magic link</span></div>
      </div>
    </div>
  );
}