/**
 * One-off: rebuild UserReviewStats from logs (star rating and/or written review per log).
 * Run after upgrading review-count rules so existing grade-only logs count toward milestones/badges.
 *
 *   pnpm --filter @geeklogs/api exec tsx src/scripts/recalculateReviewStats.ts
 */
import { prisma } from "../lib/prisma.js";
import { recalculateUserReviewStatsFromLogs } from "../services/gamification.service.js";

async function main(): Promise<void> {
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  let i = 0;
  for (const u of users) {
    i++;
    const badges = await recalculateUserReviewStatsFromLogs(u.id);
    console.log(`[${i}/${users.length}] ${u.email ?? u.id} — stats recalculated, ${badges.length} new badge(s)`);
  }
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
