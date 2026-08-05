import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export interface ProposalOption {
  id: string;
  label: string;
  title: string;
  tagline: string;
  inspiredBy: string[];
  effort: "Small" | "Medium" | "Large";
  preview?: ReactNode;
  wireframe?: string;
  coreIdea: string;
  desktop: string;
  mobile: string;
  changes: string[];
  rationale: string;
  tradeoffs: string[];
}

export interface ProposalTopic {
  id: string;
  page: string;
  type: "Page" | "Workflow";
  icon: LucideIcon;
  currentUx: string;
  options: ProposalOption[];
}

/** Builds an option with safe defaults so missing keys can't break the catalog. */
export function op(o: ProposalOption): ProposalOption {
  return o;
}

/** Renders a text wireframe/ASCII layout block. */
export function wf(lines: string[]): string {
  return lines.map((l) => l.padEnd(46)).join("\n");
}