import type { BadgeMedium } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

const BADGE_MEDIA: { medium: BadgeMedium; label: string; icon: string }[] = [
  { medium: "MOVIE", label: "Movie", icon: "🎬" },
  { medium: "TV_SHOW", label: "TV Show", icon: "📺" },
  { medium: "ANIME", label: "Anime", icon: "🌸" },
  { medium: "MANGA", label: "Manga", icon: "📖" },
  { medium: "COMIC", label: "Comic", icon: "💬" },
  { medium: "BOOK", label: "Book", icon: "📚" },
];

const REVIEW_TIERS = [
  [1, "First review", "✍️"],
  [5, "Reviewer I", "📝"],
  [10, "Reviewer II", "⭐"],
  [25, "Critic", "🏅"],
  [50, "Expert", "🏆"],
] as const;

const LOG_TIERS = [
  [1, "First log", "📌"],
  [5, "Logger I", "📋"],
  [10, "Logger II", "📚"],
  [25, "Enthusiast", "🌟"],
  [50, "Expert", "👑"],
] as const;

const GLOBAL_REVIEW_TIERS = [
  [25, "Dedicated Reviewer", "✨"],
  [100, "Prolific Critic", "🏆"],
] as const;

const GLOBAL_LOG_TIERS = [
  [25, "Dedicated Logger", "✨"],
  [100, "Prolific Logger", "🏆"],
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
    await prisma.milestone.upsert({
      where: {
        metric_scope_medium_threshold: {
          metric: "reviews",
          scope: "global",
          medium: null,
          threshold,
        },
      },
      create: {
        metric: "reviews",
        scope: "global",
        medium: null,
        threshold,
        label,
        icon,
        sortOrder: sortOrder++,
      },
      update: { label, icon, sortOrder: sortOrder++ },
    });
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
    await prisma.milestone.upsert({
      where: {
        metric_scope_medium_threshold: {
          metric: "logs",
          scope: "global",
          medium: null,
          threshold,
        },
      },
      create: {
        metric: "logs",
        scope: "global",
        medium: null,
        threshold,
        label,
        icon,
        sortOrder: sortOrder++,
      },
      update: { label, icon, sortOrder: sortOrder++ },
    });
  }

  const count = await prisma.milestone.count();
  console.log(`Seeded ${count} milestones.`);
}

const isRunDirectly =
  typeof process !== "undefined" &&
  process.argv[1] != null &&
  (process.argv[1].endsWith("seedMilestones.ts") || process.argv[1].endsWith("seedMilestones.js"));
if (isRunDirectly) {
  runSeedMilestones()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
