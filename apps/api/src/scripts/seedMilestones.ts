import type { BadgeMedium } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

const BADGE_MEDIA: { medium: BadgeMedium; label: string; icon: string }[] = [
  { medium: "MOVIE", label: "Movie", icon: "🎬" },
  { medium: "TV_SHOW", label: "TV Show", icon: "📺" },
  { medium: "ANIME", label: "Anime", icon: "🌸" },
  { medium: "MANGA", label: "Manga", icon: "📖" },
  { medium: "COMIC", label: "Comic", icon: "🦸" },
  { medium: "BOOK", label: "Book", icon: "📚" },
  { medium: "GAME", label: "Game", icon: "🎮" },
  { medium: "BOARD_GAME", label: "Board Game", icon: "🎲" },
];

const REVIEW_TIERS = [
  [1, "First review", "✍️"],
  [5, "Reviewer I", "📝"],
  [10, "Reviewer II", "⭐"],
  [25, "Critic", "🏅"],
  [50, "Expert", "🏆"],
  [75, "Veteran Reviewer", "📜"],
  [100, "Century Critic", "💯"],
  [150, "Prolific Writer", "✒️"],
  [200, "Dedicated Critic", "🎯"],
  [250, "Master Reviewer", "🌟"],
  [300, "Elite Reviewer", "👑"],
  [400, "Legendary Critic", "🔥"],
  [500, "Hall of Fame", "🏛️"],
] as const;

const LOG_TIERS = [
  [1, "First log", "📌"],
  [5, "Logger I", "📋"],
  [10, "Logger II", "📚"],
  [25, "Enthusiast", "🌟"],
  [50, "Expert", "👑"],
  [75, "Veteran Logger", "📜"],
  [100, "Century Logger", "💯"],
  [150, "Prolific Logger", "✒️"],
  [200, "Dedicated Logger", "🎯"],
  [250, "Master Logger", "🌟"],
  [300, "Elite Logger", "👑"],
  [400, "Legendary Logger", "🔥"],
  [500, "Hall of Fame Logger", "🏛️"],
] as const;

const GLOBAL_REVIEW_TIERS = [
  [25, "Dedicated Reviewer", "✨"],
  [100, "Prolific Critic", "🏆"],
  [250, "Master Critic", "🌟"],
  [500, "Hall of Fame Reviewer", "🏛️"],
] as const;

const GLOBAL_LOG_TIERS = [
  [25, "Dedicated Logger", "✨"],
  [100, "Prolific Logger", "🏆"],
  [250, "Master Logger", "🌟"],
  [500, "Hall of Fame Logger", "🏛️"],
] as const;

/** Ensures all milestone definitions exist. Run on API startup or CLI. */
export async function runSeedMilestones(): Promise<void> {
  let sortOrder = 0;

  for (const { medium, label: mediumLabel, icon } of BADGE_MEDIA) {
    for (const [threshold, tierLabel, tierIcon] of REVIEW_TIERS) {
      const name =
        threshold === 1 ? `First ${mediumLabel.toLowerCase()} review` : `${mediumLabel} ${tierLabel} (${threshold})`;
      await prisma.milestone.upsert({
        where: {
          metric_scope_medium_threshold: {
            metric: "reviews",
            scope: "per_medium",
            medium,
            threshold,
          },
        },
        create: {
          metric: "reviews",
          scope: "per_medium",
          medium,
          threshold,
          label: name,
          icon: threshold === 1 ? icon : tierIcon,
          sortOrder: sortOrder++,
        },
        update: { label: name, icon: threshold === 1 ? icon : tierIcon, sortOrder: sortOrder++ },
      });
    }
  }

  for (const [threshold, label, icon] of GLOBAL_REVIEW_TIERS) {
    const existing = await prisma.milestone.findFirst({
      where: { metric: "reviews", scope: "global", medium: null, threshold },
    });
    if (existing) {
      await prisma.milestone.update({
        where: { id: existing.id },
        data: { label, icon, sortOrder: sortOrder++ },
      });
    } else {
      await prisma.milestone.create({
        data: {
          metric: "reviews",
          scope: "global",
          medium: null,
          threshold,
          label,
          icon,
          sortOrder: sortOrder++,
        },
      });
    }
  }

  for (const { medium, label: mediumLabel, icon } of BADGE_MEDIA) {
    for (const [threshold, tierLabel, tierIcon] of LOG_TIERS) {
      const name =
        threshold === 1 ? `First ${mediumLabel.toLowerCase()} log` : `${mediumLabel} ${tierLabel} (${threshold})`;
      await prisma.milestone.upsert({
        where: {
          metric_scope_medium_threshold: {
            metric: "logs",
            scope: "per_medium",
            medium,
            threshold,
          },
        },
        create: {
          metric: "logs",
          scope: "per_medium",
          medium,
          threshold,
          label: name,
          icon: threshold === 1 ? icon : tierIcon,
          sortOrder: sortOrder++,
        },
        update: { label: name, icon: threshold === 1 ? icon : tierIcon, sortOrder: sortOrder++ },
      });
    }
  }

  for (const [threshold, label, icon] of GLOBAL_LOG_TIERS) {
    const existing = await prisma.milestone.findFirst({
      where: { metric: "logs", scope: "global", medium: null, threshold },
    });
    if (existing) {
      await prisma.milestone.update({
        where: { id: existing.id },
        data: { label, icon, sortOrder: sortOrder++ },
      });
    } else {
      await prisma.milestone.create({
        data: {
          metric: "logs",
          scope: "global",
          medium: null,
          threshold,
          label,
          icon,
          sortOrder: sortOrder++,
        },
      });
    }
  }

  const count = await prisma.milestone.count();
  console.log(`Seeded ${count} milestones.`);
}

/** Log a clear message when the seed fails (e.g. Milestone table not created in Supabase). */
function logSeedFailure(err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  const hint =
    msg.includes("does not exist") || msg.includes("relation") || msg.includes("Milestone")
      ? " Create the table by running apps/api/prisma/supabase-milestones.sql in Supabase SQL Editor, then restart the API."
      : "";
  console.error("Milestone seed failed:" + hint, err);
}

const isRunDirectly =
  typeof process !== "undefined" &&
  process.argv[1] != null &&
  (process.argv[1].endsWith("seedMilestones.ts") || process.argv[1].endsWith("seedMilestones.js"));
if (isRunDirectly) {
  runSeedMilestones()
    .catch((e) => {
      logSeedFailure(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
