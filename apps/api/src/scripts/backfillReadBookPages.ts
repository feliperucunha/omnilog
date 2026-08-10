/**
 * One-off: for books already marked status "read" whose pagesRead is missing or below the
 * book's page count, set pagesRead to the book's representative page count (median across
 * editions) so page-read statistics reflect the full book being read. Page counts missing
 * from ItemDetailCache are fetched from Open Library and cached before updating logs.
 *
 *   pnpm --filter @geeklogs/api exec tsx src/scripts/backfillReadBookPages.ts
 */
import { prisma } from "../lib/prisma.js";
import { getBookById } from "../services/openLibrary.js";

async function main(): Promise<void> {
  const logs = await prisma.log.findMany({
    where: { mediaType: "books", status: "read" },
    select: { id: true, externalId: true, pagesRead: true },
    orderBy: { id: "asc" },
  });
  console.log(`Found ${logs.length} read book logs.`);
  if (logs.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  const cacheRows = await prisma.itemDetailCache.findMany({
    where: {
      mediaType: "books",
      externalId: { in: [...new Set(logs.map((l) => l.externalId))] },
    },
    select: { externalId: true, pagesCount: true },
  });
  const byExternalId = new Map<string, number | null>(
    cacheRows.map((r) => [r.externalId, r.pagesCount])
  );

  let updated = 0;
  let fetched = 0;
  const fetchQueue = new Set<string>();
  for (const log of logs) {
    const cached = byExternalId.get(log.externalId);
    if (typeof cached !== "number" || cached <= 0) {
      fetchQueue.add(log.externalId);
    }
  }
  for (const externalId of fetchQueue) {
    const detail = await getBookById(externalId);
    const pagesCount = detail?.pagesCount;
    if (typeof pagesCount === "number" && pagesCount > 0) {
      await prisma.itemDetailCache.upsert({
        where: { mediaType_externalId: { mediaType: "books", externalId } },
        create: { mediaType: "books", externalId, pagesCount },
        update: { pagesCount },
      });
      byExternalId.set(externalId, pagesCount);
      fetched++;
    } else {
      byExternalId.set(externalId, null);
    }
  }
  if (fetched > 0) console.log(`Fetched and cached pagesCount for ${fetched} book(s).`);

  for (const log of logs) {
    const pagesCount = byExternalId.get(log.externalId);
    if (typeof pagesCount !== "number" || pagesCount <= 0) continue;
    const next = Math.max(log.pagesRead ?? 0, pagesCount);
    if (next === log.pagesRead) continue;
    await prisma.log.update({
      where: { id: log.id },
      data: { pagesRead: next },
    });
    updated++;
  }
  console.log(`Done. Updated pagesRead on ${updated} read book log(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());