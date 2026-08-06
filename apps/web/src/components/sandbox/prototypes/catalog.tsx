import type { ReactNode } from "react";
import { PREVIEWS } from "./previews";

export interface PrototypeEntry {
  id: string;
  label: string;
  node: ReactNode;
}

export interface PrototypeGroup {
  key: string;
  title: string;
  items: PrototypeEntry[];
}

const GROUP_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  logs: "Logs list",
  statistics: "Statistics",
  item: "Item detail",
  search: "Search",
  settings: "Settings",
  auth: "Auth",
  market: "Market",
  profile: "Public profile",
  landing: "Landing",
  "workflow-add": "Quick add",
  "workflow-edit": "Editing",
  "workflow-review": "Reviews",
  onboarding: "Onboarding",
  "market-detail": "Market listing",
  filters: "Filters & sorting",
  drawers: "Drawers",
  info: "Help & info",
};

function groupFromId(id: string): { group: string; variant: string } {
  const match = /^(.*)-([a-z])$/.exec(id);
  if (!match) return { group: id, variant: "" };
  return { group: match[1], variant: match[2].toUpperCase() };
}

export const PROTOTYPE_GROUPS: PrototypeGroup[] = (() => {
  const byGroup = new Map<string, PrototypeGroup>();
  for (const id of Object.keys(PREVIEWS)) {
    const { group, variant } = groupFromId(id);
    let entry = byGroup.get(group);
    if (!entry) {
      entry = { key: group, title: GROUP_TITLES[group] ?? group, items: [] };
      byGroup.set(group, entry);
    }
    entry.items.push({ id, label: variant || "Demo", node: PREVIEWS[id] });
  }
  return [...byGroup.values()];
})();