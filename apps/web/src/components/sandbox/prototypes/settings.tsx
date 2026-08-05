import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, ChevronDown, Search as SearchIcon } from "lucide-react";
import { springSoft } from "@/lib/animations";
import { cn } from "@/lib/utils";
import { SectionLabel } from "./kit";

type Row = { key: string; label: string; value: string; group: string };
const GROUPS = ["Profile", "Notifications", "Data", "App"];

const ROWS: Row[] = [
  { key: "vis", label: "Visibility", value: "Public", group: "Profile" },
  { key: "lang", label: "Language", value: "PT-BR", group: "Profile" },
  { key: "theme", label: "Theme", value: "Dark", group: "Profile" },
  { key: "recap", label: "Email recap", value: "On", group: "Notifications" },
  { key: "complete", label: "Complete modal", value: "On", group: "Notifications" },
  { key: "streaks", label: "Weekly streak", value: "Off", group: "Notifications" },
  { key: "export", label: "Export data", value: "CSV", group: "Data" },
  { key: "import", label: "Import", value: "Board games", group: "Data" },
  { key: "units", label: "Units", value: "h:m", group: "App" },
  { key: "region", label: "Region", value: "BR", group: "App" },
];

export function SettingsSearchable() {
  const [q, setQ] = useState("");
  const [collapse, setCollapse] = useState<Record<string, boolean>>({});
  const filtered = ROWS.filter((r) => r.label.toLowerCase().includes(q.toLowerCase()));
  const byGroup = GROUPS.map((g) => ({ g, rows: filtered.filter((r) => r.group === g) })).filter((x) => x.rows.length > 0);

  return (
    <div className="flex min-h-[28rem] flex-col gap-3 bg-[var(--color-dark)] p-4">
      <div className="flex items-center gap-2 rounded-xl border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/60 px-3 py-2.5">
        <SearchIcon className="size-4 text-[var(--color-light)]" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search settings…"
          className="flex-1 bg-transparent text-sm text-[var(--color-lightest)] outline-none placeholder:text-[var(--color-light)]"
        />
      </div>
      <div className="flex flex-col gap-3">
        {byGroup.map(({ g: group, rows }) => (
          <div key={group} className="flex flex-col gap-1 rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40 p-1.5">
            <button type="button" onClick={() => setCollapse((c) => ({ ...c, [group]: !c[group] }))} className="flex items-center gap-1 px-2 py-1">
              <ChevronDown className={cn("size-3 text-[var(--color-light)] transition-transform", collapse[group] && "-rotate-90")} aria-hidden />
              <SectionLabel>{group}</SectionLabel>
            </button>
            {!collapse[group] && rows.map((r) => (
              <div key={r.key} className="flex items-center justify-between rounded-lg px-2 py-2 text-[11px] hover:bg-[var(--color-mid)]/10">
                <span className="text-[var(--color-lightest)]">{r.label}</span>
                <span className="font-semibold text-[var(--btn-gradient-start)]">{r.value}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SettingsSheets() {
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({ Language: "PT-BR", Theme: "Dark" });

  const rows = [
    { label: "Language", value: values.Language, options: ["PT-BR", "English", "Español"] },
    { label: "Theme", value: values.Theme, options: ["Dark", "Light", "System"] },
    { label: "Email recap", value: values["Email recap"] ?? "On", toggle: true },
    { label: "Export data", value: "Open manager" },
  ];

  return (
    <div className="relative flex min-h-[28rem] flex-col bg-[var(--color-dark)] p-4">
      <SectionLabel className="mb-1">Settings</SectionLabel>
      <div className="flex flex-col gap-1 rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40 p-1.5">
        {rows.map((r) => (
          <button
            key={r.label}
            type="button"
            onClick={() => setOpenRow(r.label)}
            className="flex items-center gap-2 rounded-lg px-2.5 py-2.5 text-left hover:bg-[var(--color-mid)]/10"
          >
            <span className="flex-1 text-[11px] text-[var(--color-lightest)]">{r.label}</span>
            <span className="text-[11px] text-[var(--color-light)]">{r.value}</span>
            <ChevronRight className="size-3.5 text-[var(--color-light)]" aria-hidden />
          </button>
        ))}
      </div>

      <AnimatePresence>
        {openRow && (
          <>
            <motion.button type="button" aria-label="Close" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-10 bg-black/50" onClick={() => setOpenRow(null)} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={springSoft} className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 rounded-t-2xl border-t border-[var(--color-mid)]/30 bg-[var(--color-dark)] p-4">
              <div className="mx-auto h-1 w-10 rounded-full bg-[var(--color-mid)]" />
              <p className="text-sm font-bold text-[var(--color-lightest)]">{openRow}</p>
              <div className="flex flex-col gap-1.5">
                {(rows.find((r) => r.label === openRow)?.options ?? []).map((opt) => (
                  <button key={opt} type="button" onClick={() => { setValues((v) => ({ ...v, [openRow]: opt })); setOpenRow(null); }} className="rounded-lg bg-[var(--color-darkest)]/50 px-3 py-2 text-left text-xs font-semibold text-[var(--color-lightest)]">
                    {opt} {values[openRow] === opt && <span className="float-right text-[var(--btn-gradient-start)]">✓</span>}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SettingsAccount() {
  const items = [
    { label: "Profile", desc: "Name, avatar, bio", tile: true },
    { label: "Privacy", desc: "Visibility, export", tile: true },
    { label: "Plan", desc: "Pro · renews Sep 12", tile: true },
    { label: "Data tools", desc: "Import, cleanup", tile: true },
  ];
  return (
    <div className="flex min-h-[28rem] flex-col gap-3 bg-[var(--color-dark)] p-4">
      <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/50 p-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--btn-gradient-start)] text-lg font-black text-white">F</span>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-[var(--color-lightest)]">Felipe · @felipe</span>
          <span className="text-[11px] text-[var(--color-light)]">Pro plan · renews Sep 12</span>
        </div>
        <button type="button" className="ml-auto rounded-lg border border-[var(--color-mid)]/40 px-2.5 py-1 text-[10px] font-semibold text-[var(--color-light)]">Edit</button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map((it) => (
          <button key={it.label} type="button" className="flex flex-col gap-1 rounded-xl border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/40 p-3 text-left">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--btn-gradient-start)]/15 text-[var(--btn-gradient-start)]">◈</span>
            <span className="text-xs font-bold text-[var(--color-lightest)]">{it.label}</span>
            <span className="truncate text-[10px] text-[var(--color-light)]">{it.desc}</span>
          </button>
        ))}
      </div>

      <div className="rounded-xl bg-[var(--btn-gradient-start)]/10 p-3">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-[var(--color-lightest)]">Usage</span>
          <span className="text-[var(--color-light)]">482 / 500 logs</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-mid)]/30">
          <div className="h-full rounded-full bg-[var(--btn-gradient-start)]" style={{ width: "96%" }} />
        </div>
      </div>
    </div>
  );
}