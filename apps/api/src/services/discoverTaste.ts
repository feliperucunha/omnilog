import {
  DISCOVER_MIN_LOGS,
  DISCOVER_PLANNED_STATUS,
  DISCOVER_TASTE_MAX_LOGS_PER_CATEGORY,
  DISCOVER_TASTE_PROMPT_LOGS_PER_CATEGORY,
  MEDIA_TYPES,
  decodeHtmlEntities,
  type BoardGameProvider,
  type DiscoverCategoryTaste,
  type DiscoverTasteChartItem,
  type DiscoverTasteSnapshot,
  type MediaType,
  type SearchResult,
} from "@geeklogs/shared";
import { prisma } from "../lib/prisma.js";
import { parseLogAffinityContextJson } from "../lib/logAffinityContext.js";
import { parseGenresJson, parseMechanicsJson } from "../lib/serializeLog.js";
import { getRecommendationsForUser } from "../routes/search.js";
import {
  buildDiscoverTastePrompt,
  parseDiscoverTasteResponse,
  type DiscoverTasteCandidate,
  type DiscoverTastePromptCategory,
} from "../lib/discoverTaste.js";
import { generateAiJson } from "./ai.js";

const RECOMMENDATIONS_TIMEOUT_MS = 5_000;

function truncate(value: string | null | undefined, max: number): string {
  const decoded = decodeHtmlEntities(value ?? "").trim();
  return decoded.length <= max ? decoded : `${decoded.slice(0, max)}…`;
}

function normalizeTitle(value: string): string {
  return decodeHtmlEntities(value).trim().toLowerCase();
}

function parseStringArray(json: string | null): string[] {
  try {
    const parsed = JSON.parse(json ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(0, 30) : [];
  } catch {
    return [];
  }
}

async function withTimeout<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const guarded = work.then(
    (value) => ({ ok: true as const, value }),
    () => ({ ok: false as const })
  );
  const timedOut = new Promise<{ ok: false }>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false }), ms);
  });
  try {
    const result = await Promise.race([guarded, timedOut]);
    return result.ok ? result.value : fallback;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function loadLogs(userId: string, mediaType: MediaType) {
  return prisma.log.findMany({
    where: { userId, mediaType },
    orderBy: [{ updatedAt: "desc" }],
    take: DISCOVER_TASTE_MAX_LOGS_PER_CATEGORY,
    select: {
      id: true,
      externalId: true,
      title: true,
      grade: true,
      status: true,
      review: true,
      genres: true,
      mechanics: true,
      affinityContext: true,
      own: true,
      wantToBuy: true,
      sold: true,
      matchesPlayed: true,
      contentHours: true,
      hoursToBeat: true,
      averageWeight: true,
      episode: true,
      chapter: true,
      volume: true,
      pagesRead: true,
      startedAt: true,
      completedAt: true,
      updatedAt: true,
    },
  });
}

type TasteLog = Awaited<ReturnType<typeof loadLogs>>[number];

function summarizeLogs(logs: TasteLog[]): Record<string, unknown> {
  const grades = logs.map((log) => log.grade).filter((grade): grade is number => grade != null);
  const statusCounts = new Map<string, number>();
  const genreCounts = new Map<string, number>();
  const mechanicCounts = new Map<string, number>();

  for (const log of logs) {
    if (log.status) statusCounts.set(log.status, (statusCounts.get(log.status) ?? 0) + 1);
    for (const genre of parseGenresJson(log.genres ?? null) ?? parseStringArray(log.genres ?? null)) {
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    }
    for (const mechanic of parseMechanicsJson(log.mechanics ?? null) ?? parseStringArray(log.mechanics ?? null)) {
      mechanicCounts.set(mechanic, (mechanicCounts.get(mechanic) ?? 0) + 1);
    }
  }

  const top = (counts: Map<string, number>) =>
    [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));

  return {
    count: logs.length,
    meanGrade: grades.length > 0 ? (grades.reduce((sum, grade) => sum + grade, 0) / grades.length).toFixed(1) : null,
    gradedCount: grades.length,
    statusCounts: Object.fromEntries(statusCounts),
    topGenres: top(genreCounts),
    topMechanics: top(mechanicCounts),
  };
}

function buildCharts(logs: TasteLog[], mediaType: MediaType): DiscoverTasteChartItem[] {
  const counts = new Map<string, number>();

  for (const log of logs) {
    const affinity = parseLogAffinityContextJson(log.affinityContext ?? null);
    let values: string[] = [];

    if (mediaType === "boardgames") {
      values = [
        ...(parseMechanicsJson(log.mechanics ?? null) ?? parseStringArray(log.mechanics ?? null)),
        ...(parseGenresJson(log.genres ?? null) ?? parseStringArray(log.genres ?? null)),
      ];
    } else if (mediaType === "books") {
      values = [
        ...(parseGenresJson(log.genres ?? null) ?? parseStringArray(log.genres ?? null)),
        ...(affinity?.books?.subjects ?? []),
      ];
    } else if (mediaType === "manga") {
      values = [
        ...(parseGenresJson(log.genres ?? null) ?? parseStringArray(log.genres ?? null)),
        ...(affinity?.manga?.genres ?? []),
        ...(affinity?.manga?.themes ?? []),
        ...(affinity?.manga?.demographics ?? []),
      ];
    } else {
      values = parseGenresJson(log.genres ?? null) ?? parseStringArray(log.genres ?? null);
    }

    for (const value of values) {
      const label = decodeHtmlEntities(value).trim();
      if (!label) continue;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([label, count]) => ({ label, count }));
}

function toPromptLog(log: TasteLog): Record<string, unknown> {
  const affinityContext = parseLogAffinityContextJson(log.affinityContext ?? null);
  return {
    title: truncate(log.title, 200),
    grade: log.grade,
    status: log.status,
    review: truncate(log.review, 180) || undefined,
    genres: (parseGenresJson(log.genres ?? null) ?? parseStringArray(log.genres ?? null)).slice(0, 5),
    mechanics: (parseMechanicsJson(log.mechanics ?? null) ?? parseStringArray(log.mechanics ?? null)).slice(0, 5),
    affinityContext: affinityContext ? truncate(JSON.stringify(affinityContext), 300) : undefined,
    own: log.own,
    wantToBuy: log.wantToBuy,
    sold: log.sold,
    matchesPlayed: log.matchesPlayed,
    contentHours: log.contentHours,
    hoursToBeat: log.hoursToBeat,
    averageWeight: log.averageWeight,
    pagesRead: log.pagesRead,
  };
}

async function loadCandidates(
  userId: string,
  mediaType: MediaType,
  boardGameProvider: BoardGameProvider,
  logs: TasteLog[]
): Promise<DiscoverTasteCandidate[]> {
  const results = await withTimeout(
    getRecommendationsForUser(userId, mediaType, boardGameProvider).then((payload) =>
      "results" in payload ? payload.results : []
    ),
    RECOMMENDATIONS_TIMEOUT_MS,
    [] as SearchResult[]
  );

  const knownIds = new Set(logs.map((log) => log.externalId));
  const knownTitles = new Set(logs.map((log) => normalizeTitle(log.title)));

  return results
    .filter((item) => !knownIds.has(item.id) && !knownTitles.has(normalizeTitle(item.title)))
    .slice(0, 12)
    .map((item) => ({
      id: item.id,
      title: truncate(item.title, 300),
      subtitle: truncate(item.subtitle, 200) || null,
      genres: Array.isArray(item.genres)
        ? item.genres.slice(0, 30).map((genre) => truncate(genre, 80))
        : [],
      year: item.year ?? null,
      score: item.score ?? null,
    }));
}

async function buildCategoryInput(
  userId: string,
  mediaType: MediaType,
  boardGameProvider: BoardGameProvider
): Promise<{
  mediaType: MediaType;
  promptCategory: DiscoverTastePromptCategory;
  charts: DiscoverTasteChartItem[];
  planned: DiscoverCategoryTaste["planned"];
  allowedBeyondIds: Set<string>;
}> {
  const logs = await loadLogs(userId, mediaType);
  const candidates = await loadCandidates(userId, mediaType, boardGameProvider, logs);

  return {
    mediaType,
    promptCategory: {
      mediaType,
      summary: summarizeLogs(logs),
      candidates,
      logs: logs.slice(0, DISCOVER_TASTE_PROMPT_LOGS_PER_CATEGORY).map(toPromptLog),
    },
    charts: buildCharts(logs, mediaType),
    planned: logs
      .filter((log) => log.status === DISCOVER_PLANNED_STATUS[mediaType])
      .slice(0, 8)
      .map((log) => ({
        id: log.id,
        externalId: log.externalId,
        title: truncate(log.title, 300),
        status: log.status ?? DISCOVER_PLANNED_STATUS[mediaType],
      })),
    allowedBeyondIds: new Set(candidates.map((candidate) => candidate.id)),
  };
}

export async function generateDiscoverTasteSnapshot(
  userId: string,
  locale: string,
  requestedMediaTypes: MediaType[] = [...MEDIA_TYPES],
  boardGameProvider: BoardGameProvider = "bgg"
): Promise<DiscoverTasteSnapshot> {
  const counts = await prisma.log.groupBy({
    by: ["mediaType"],
    where: { userId },
    _count: { _all: true },
  });
  const countByType = new Map(counts.map((row) => [row.mediaType, row._count._all]));
  const eligibleMediaTypes = requestedMediaTypes.filter(
    (mediaType) => (countByType.get(mediaType) ?? 0) >= DISCOVER_MIN_LOGS
  );

  if (eligibleMediaTypes.length === 0) {
    return { refreshedAt: new Date().toISOString(), categories: {} };
  }

  const inputs = await Promise.all(
    eligibleMediaTypes.map((mediaType) => buildCategoryInput(userId, mediaType, boardGameProvider))
  );
  const promptCategories = inputs.map((input) => input.promptCategory);
  const chartsByType: Partial<Record<MediaType, DiscoverTasteChartItem[]>> = {};
  const plannedByType: Partial<Record<MediaType, DiscoverCategoryTaste["planned"]>> = {};
  const allowedBeyondIds: Partial<Record<MediaType, Set<string>>> = {};

  for (const input of inputs) {
    chartsByType[input.mediaType] = input.charts;
    plannedByType[input.mediaType] = input.planned;
    allowedBeyondIds[input.mediaType] = input.allowedBeyondIds;
  }

  const prompt = buildDiscoverTastePrompt({ locale, categories: promptCategories });
  const responseText = await generateAiJson(prompt);
  const aiCategories = parseDiscoverTasteResponse(responseText, eligibleMediaTypes, allowedBeyondIds);
  const categories: Partial<Record<MediaType, DiscoverCategoryTaste>> = {};

  for (const mediaType of eligibleMediaTypes) {
    const generated = aiCategories[mediaType];
    if (!generated) continue;
    categories[mediaType] = {
      lines: generated.lines,
      charts: chartsByType[mediaType] ?? [],
      planned: plannedByType[mediaType] ?? [],
      beyond: generated.beyond,
    };
  }

  return { refreshedAt: new Date().toISOString(), categories };
}
