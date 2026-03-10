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

async function main() {
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

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());