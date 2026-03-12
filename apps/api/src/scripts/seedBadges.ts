import type { BadgeConditionType, BadgeMedium } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

const badges: Array<{
  name: string;
  description: string;
  icon: string;
  medium: BadgeMedium | null;
  rarity: "common" | "rare" | "epic" | "legendary";
  conditionType: string;
  conditionValue: number;
}> = [];

function add(
  name: string,
  description: string,
  icon: string,
  medium: BadgeMedium | null,
  conditionType: string,
  conditionValue: number,
  rarity: "common" | "rare" | "epic" | "legendary" = "common"
) {
  badges.push({
    name,
    description,
    icon,
    medium,
    rarity,
    conditionType,
    conditionValue,
  });
}

// First review per medium (REVIEW_COUNT_PER_MEDIA = 1)
add("First Movie Review", "You wrote your first movie review.", "🎬", "MOVIE", "REVIEW_COUNT_PER_MEDIA", 1);
add("First TV Show Review", "You wrote your first TV show review.", "📺", "TV_SHOW", "REVIEW_COUNT_PER_MEDIA", 1);
add("First Anime Review", "You wrote your first anime review.", "🌸", "ANIME", "REVIEW_COUNT_PER_MEDIA", 1);
add("First Manga Review", "You wrote your first manga review.", "📖", "MANGA", "REVIEW_COUNT_PER_MEDIA", 1);
add("First Comic Review", "You wrote your first comic review.", "💬", "COMIC", "REVIEW_COUNT_PER_MEDIA", 1);
add("First Book Review", "You wrote your first book review.", "📚", "BOOK", "REVIEW_COUNT_PER_MEDIA", 1);

// Progression per medium: Reviewer I (5), II (10), Critic (25), Expert (50)
const tiers = [
  [5, "I", "Reviewer", "common"],
  [10, "II", "Reviewer", "common"],
  [25, "", "Critic", "rare"],
  [50, "", "Expert", "epic"],
] as const;

const media: Array<{ medium: BadgeMedium; label: string; icon: string }> = [
  { medium: "MOVIE", label: "Movie", icon: "🎬" },
  { medium: "TV_SHOW", label: "TV Show", icon: "📺" },
  { medium: "ANIME", label: "Anime", icon: "🌸" },
  { medium: "MANGA", label: "Manga", icon: "📖" },
  { medium: "COMIC", label: "Comic", icon: "💬" },
  { medium: "BOOK", label: "Book", icon: "📚" },
];

for (const { medium, label, icon } of media) {
  for (const [value, num, title, rarity] of tiers) {
    const name = num ? `${label} ${title} ${num} (${value})` : `${label} ${title} (${value})`;
    const desc = `You wrote ${value} ${label.toLowerCase()} reviews.`;
    add(name, desc, icon, medium, "REVIEW_COUNT_PER_MEDIA", value, rarity as "common" | "rare" | "epic" | "legendary");
  }
}

// Global badges
add(
  "Multi-Medium Explorer",
  "You wrote reviews in 3 different media types.",
  "🌐",
  null,
  "MEDIA_TYPES_REVIEWED",
  3,
  "rare"
);
add(
  "Omni Media Critic",
  "You wrote reviews in all 6 media types.",
  "🌟",
  null,
  "MEDIA_TYPES_REVIEWED",
  6,
  "legendary"
);
add("Dedicated Reviewer", "You wrote 25 reviews total.", "✨", null, "REVIEW_COUNT_GLOBAL", 25, "rare");
add("Prolific Critic", "You wrote 100 reviews total.", "🏆", null, "REVIEW_COUNT_GLOBAL", 100, "legendary");

// Review likes
add("Popular Review", "One of your reviews received 5 likes.", "👍", null, "REVIEW_LIKES", 5, "rare");
add("Viral Critic", "Your reviews received 25 likes total.", "🔥", null, "REVIEW_LIKES", 25, "epic");

// Streaks
add("3 Day Review Streak", "You wrote reviews 3 days in a row.", "📅", null, "REVIEW_STREAK", 3, "common");
add("7 Day Review Streak", "You wrote reviews 7 days in a row.", "📆", null, "REVIEW_STREAK", 7, "rare");
add("30 Day Review Streak", "You wrote reviews 30 days in a row.", "🗓️", null, "REVIEW_STREAK", 30, "legendary");

// First log per medium (items added, with or without review)
add("First Movie Log", "You added your first movie.", "🎬", "MOVIE", "LOG_COUNT_PER_MEDIA", 1);
add("First TV Show Log", "You added your first TV show.", "📺", "TV_SHOW", "LOG_COUNT_PER_MEDIA", 1);
add("First Anime Log", "You added your first anime.", "🌸", "ANIME", "LOG_COUNT_PER_MEDIA", 1);
add("First Manga Log", "You added your first manga.", "📖", "MANGA", "LOG_COUNT_PER_MEDIA", 1);
add("First Comic Log", "You added your first comic.", "💬", "COMIC", "LOG_COUNT_PER_MEDIA", 1);
add("First Book Log", "You added your first book.", "📚", "BOOK", "LOG_COUNT_PER_MEDIA", 1);

// Log progression per medium (items added)
const logTiers = [
  [5, "I", "Logger", "common"],
  [10, "II", "Logger", "common"],
  [25, "", "Enthusiast", "rare"],
  [50, "", "Expert", "epic"],
] as const;
for (const { medium, label, icon } of media) {
  for (const [value, num, title, rarity] of logTiers) {
    const name = num ? `${label} ${title} ${num} (${value})` : `${label} ${title} (${value})`;
    const desc = `You added ${value} ${label.toLowerCase()} items.`;
    add(name, desc, icon, medium, "LOG_COUNT_PER_MEDIA", value, rarity as "common" | "rare" | "epic" | "legendary");
  }
}

// Global log badges
add("Multi-Medium Collector", "You added items in 3 different media types.", "🌐", null, "LOG_MEDIA_TYPES_LOGGED", 3, "rare");
add("Omni Collector", "You added items in all 6 media types.", "🌟", null, "LOG_MEDIA_TYPES_LOGGED", 6, "legendary");
add("Dedicated Logger", "You added 25 items total.", "✨", null, "LOG_COUNT_GLOBAL", 25, "rare");
add("Prolific Logger", "You added 100 items total.", "🏆", null, "LOG_COUNT_GLOBAL", 100, "legendary");

/** Run from API startup or CLI: ensures all badge definitions exist in the DB. Does not disconnect Prisma. */
export async function runSeedBadges(): Promise<void> {
  for (const b of badges) {
    const existing = await prisma.badge.findFirst({ where: { name: b.name } });
    const data = {
      name: b.name,
      description: b.description,
      icon: b.icon,
      medium: b.medium,
      rarity: b.rarity,
      conditionType: b.conditionType as BadgeConditionType,
      conditionValue: b.conditionValue,
    };
    if (existing) {
      await prisma.badge.update({ where: { id: existing.id }, data });
    } else {
      await prisma.badge.create({ data });
    }
  }
  console.log(`Seeded ${badges.length} badges.`);
}

const isRunDirectly =
  typeof process !== "undefined" &&
  process.argv[1] != null &&
  (process.argv[1].endsWith("seedBadges.ts") || process.argv[1].endsWith("seedBadges.js"));
if (isRunDirectly) {
  runSeedBadges()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}