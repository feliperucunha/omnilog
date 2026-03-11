import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ItemImage } from "@/components/ItemImage";
import { StarRating } from "@/components/StarRating";
import { gradeToStars } from "@/lib/gradeStars";
import type { MediaType, SearchResult } from "@logeverything/shared";
import { MEDIA_TYPES, COMPLETED_STATUSES, LOG_STATUS_OPTIONS } from "@logeverything/shared";
import { apiFetch, invalidateLogsAndItemsCache, LOG_LIMIT_REACHED_CODE } from "@/lib/api";
import { useMe } from "@/contexts/MeContext";
import { useLocale } from "@/contexts/LocaleContext";
import { toast } from "sonner";
import { Loader2, Upload, FileSpreadsheet, ChevronDown, ChevronRight } from "lucide-react";
import { parseSheetFile, type ParsedRow, type SheetParseResult } from "@/lib/parseSheet";

const DELAY_BETWEEN_REQUESTS_MS = 350;

function getDefaultCompletedStatus(mediaType: MediaType): string {
  const options = LOG_STATUS_OPTIONS[mediaType];
  const completed = options.find((s) => (COMPLETED_STATUSES as readonly string[]).includes(s));
  return completed ?? options[0] ?? "completed";
}

interface BatchEntryTabProps {
  onDone: () => void;
  onCancel: () => void;
}

export function BatchEntryTab({ onDone, onCancel }: BatchEntryTabProps) {
  const { t } = useLocale();
  const { me } = useMe();
  const boardGameProvider = me?.boardGameProvider ?? "bgg";

  const [mediaType, setMediaType] = useState<MediaType>("movies");
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<SheetParseResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [loadingParse, setLoadingParse] = useState(false);
  const [previewResult, setPreviewResult] = useState<SearchResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewRow, setPreviewRow] = useState<ParsedRow | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [failedReasons, setFailedReasons] = useState<Array<{ name: string; reason: string }>>([]);
  const [exampleOpen, setExampleOpen] = useState(false);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      setFile(f ?? null);
      setParseResult(null);
      setParseError(null);
      setPreviewResult(null);
      setPreviewRow(null);
      setFailedReasons([]);
      if (!f) return;
      setLoadingParse(true);
      try {
        const result = await parseSheetFile(f);
        setParseResult(result);
        if (!result.ok) setParseError(result.error);
      } catch {
        setParseError(t("batchEntry.parseError"));
      } finally {
        setLoadingParse(false);
      }
    },
    [t]
  );

  const handleLoadPreview = useCallback(async () => {
    if (!parseResult?.ok || parseResult.rows.length === 0) return;
    const first = parseResult.rows[0];
    setPreviewRow(first);
    setLoadingPreview(true);
    setPreviewResult(null);
    try {
      const params = new URLSearchParams({
        type: mediaType,
        q: first.name,
      });
      if (mediaType === "boardgames" && boardGameProvider) {
        params.set("boardGameProvider", boardGameProvider);
      }
      const data = await apiFetch<{ results: SearchResult[] }>(`/search?${params.toString()}`);
      const results = data?.results ?? [];
      setPreviewResult(results[0] ?? null);
      if (results.length === 0) {
        toast.error(t("batchEntry.noResultFor", { name: first.name }));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("batchEntry.previewError"));
    } finally {
      setLoadingPreview(false);
    }
  }, [parseResult, mediaType, boardGameProvider, t]);

  const handleConfirmAndAddAll = useCallback(async () => {
    if (!parseResult?.ok || parseResult.rows.length === 0) return;
    const status = getDefaultCompletedStatus(mediaType);
    setConfirming(true);
    setBatchProgress({ current: 0, total: parseResult.rows.length });
    setFailedReasons([]);
    const reasons: Array<{ name: string; reason: string }> = [];
    let added = 0;
    for (let i = 0; i < parseResult.rows.length; i++) {
      setBatchProgress({ current: i + 1, total: parseResult.rows.length });
      const row = parseResult.rows[i];
      try {
        const params = new URLSearchParams({ type: mediaType, q: row.name });
        if (mediaType === "boardgames" && boardGameProvider) {
          params.set("boardGameProvider", boardGameProvider);
        }
        const data = await apiFetch<{ results: SearchResult[] }>(`/search?${params.toString()}`);
        const results = data?.results ?? [];
        const hit = results[0];
        if (hit) {
          const grade = row.grade ?? null;
          await apiFetch("/logs", {
            method: "POST",
            body: JSON.stringify({
              mediaType,
              externalId: hit.id,
              title: hit.title,
              image: hit.image ?? null,
              grade,
              review: row.review?.trim() || null,
              status,
            }),
          });
          added++;
        } else {
          reasons.push({
            name: row.name,
            reason: t("batchEntry.noResultFor", { name: row.name }),
          });
        }
        await new Promise((r) => setTimeout(r, DELAY_BETWEEN_REQUESTS_MS));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (msg === LOG_LIMIT_REACHED_CODE) {
          reasons.push({ name: row.name, reason: t("tiers.logLimitReached") });
          toast.error(t("tiers.logLimitReached"));
          break;
        }
        reasons.push({
          name: row.name,
          reason: msg || t("batchEntry.unknownError"),
        });
      }
    }
    setConfirming(false);
    setBatchProgress(null);
    setFailedReasons(reasons);
    invalidateLogsAndItemsCache();
    if (added > 0) {
      toast.success(t("batchEntry.addedCount", { count: String(added) }));
      onDone();
    }
    if (reasons.length > 0) {
      toast.error(t("batchEntry.someFailed", { count: String(reasons.length) }));
    }
  }, [parseResult, mediaType, boardGameProvider, t, onDone]);

  const canPreview = parseResult?.ok && parseResult.rows.length > 0 && !loadingPreview;

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <Label className="text-sm font-medium text-[var(--color-lightest)]">
          {t("batchEntry.category")}
        </Label>
        <Select
          value={mediaType}
          onValueChange={(v) => {
            setMediaType(v as MediaType);
            setPreviewResult(null);
            setPreviewRow(null);
          }}
          options={MEDIA_TYPES.map((type) => ({
            value: type,
            label: t(`nav.${type}`),
          }))}
          triggerClassName="w-full max-w-xs h-10"
          aria-label={t("batchEntry.category")}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-[var(--color-lightest)]">
          {t("batchEntry.uploadFile")}
        </Label>
        <p className="text-xs text-[var(--color-light)]">
          {t("batchEntry.fileHint")}
        </p>
        <div className="rounded-lg border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/30 overflow-hidden">
          <button
            type="button"
            onClick={() => setExampleOpen((o) => !o)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-[var(--color-lightest)] hover:bg-[var(--color-mid)]/10 focus:outline-none focus:ring-2 focus:ring-[var(--color-mid)] focus:ring-inset"
            aria-expanded={exampleOpen}
          >
            {exampleOpen ? (
              <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
            )}
            {t("batchEntry.exampleFormatTitle")}
          </button>
          {exampleOpen && (
            <div className="border-t border-[var(--color-mid)]/20 px-3 py-3">
              <p className="mb-3 text-xs text-[var(--color-light)]">
                {t("batchEntry.exampleFormatIntro")}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[280px] border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[var(--color-mid)]/30">
                      <th className="py-2 pr-3 text-left font-semibold text-[var(--color-lightest)]">
                        {t("batchEntry.exampleColumnName")}
                      </th>
                      <th className="py-2 pr-3 text-left font-semibold text-[var(--color-lightest)]">
                        {t("batchEntry.exampleColumnReview")}
                      </th>
                      <th className="py-2 text-left font-semibold text-[var(--color-lightest)]">
                        {t("batchEntry.exampleColumnRate")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-[var(--color-light)]">
                    <tr className="border-b border-[var(--color-mid)]/20">
                      <td className="py-1.5 pr-3">The Shawshank Redemption</td>
                      <td className="py-1.5 pr-3">A masterpiece.</td>
                      <td className="py-1.5">9.5</td>
                    </tr>
                    <tr className="border-b border-[var(--color-mid)]/20">
                      <td className="py-1.5 pr-3">Inception</td>
                      <td className="py-1.5 pr-3"></td>
                      <td className="py-1.5">8</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 pr-3">Interstellar</td>
                      <td className="py-1.5 pr-3">Loved the visuals.</td>
                      <td className="py-1.5">9</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-[var(--color-light)]">
                {t("batchEntry.exampleFormatNote")}
              </p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
            id="batch-file-input"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => document.getElementById("batch-file-input")?.click()}
            disabled={loadingParse}
          >
            {loadingParse ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="size-4" aria-hidden />
            )}
            <span className="ml-2">{file ? file.name : t("batchEntry.chooseFile")}</span>
          </Button>
          {parseResult?.ok && (
            <span className="flex items-center gap-1.5 text-sm text-[var(--color-light)]">
              <FileSpreadsheet className="size-4" aria-hidden />
              {parseResult.rows.length} {t("batchEntry.rows")}
            </span>
          )}
        </div>
        {parseError && (
          <p className="text-sm text-red-400" role="alert">
            {parseError}
          </p>
        )}
      </div>

      {canPreview && !previewRow && (
        <Button type="button" variant="secondary" size="sm" onClick={handleLoadPreview}>
          {t("batchEntry.previewFirst")}
        </Button>
      )}

      {loadingPreview && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-light)]">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t("batchEntry.matchingFirst")}
        </div>
      )}

      {previewRow && previewResult && (
        <div className="rounded-lg border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/50 p-4">
          <p className="mb-3 text-xs font-medium text-[var(--color-light)]">
            {t("batchEntry.previewTitle")}
          </p>
          <div className="flex gap-4">
            <ItemImage
              src={previewResult.image}
              alt=""
              className="h-24 w-16 shrink-0 rounded object-cover"
              fitContent
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-[var(--color-lightest)]">
                {previewResult.title}
              </p>
              {previewRow.grade != null && (
                <div className="mt-1">
                  <StarRating value={gradeToStars(previewRow.grade)} readOnly size="sm" />
                </div>
              )}
              {previewRow.review && (
                <p className="mt-2 line-clamp-2 text-xs text-[var(--color-light)]">
                  {previewRow.review}
                </p>
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmAndAddAll}
              disabled={confirming}
            >
              {confirming ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  <span className="ml-2">{t("batchEntry.adding")}</span>
                </>
              ) : (
                t("batchEntry.confirmAndAddAll")
              )}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={confirming}>
              {t("common.cancel")}
            </Button>
          </div>
          {confirming && batchProgress && batchProgress.total > 0 && (
            <div className="mt-4 flex flex-col gap-2" role="progressbar" aria-valuenow={batchProgress.current} aria-valuemin={0} aria-valuemax={batchProgress.total} aria-label={t("batchEntry.addingProgress", { current: String(batchProgress.current), total: String(batchProgress.total) })}>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-darkest)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--btn-gradient-start)] to-[var(--btn-gradient-end)] transition-all duration-300"
                  style={{
                    width: `${Math.round((batchProgress.current / batchProgress.total) * 100)}%`,
                  }}
                />
              </div>
              <p className="text-center text-sm font-medium text-[var(--color-lightest)]">
                {Math.round((batchProgress.current / batchProgress.total) * 100)}%
              </p>
            </div>
          )}
          {failedReasons.length > 0 && (
            <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
              <p className="mb-2 text-sm font-medium text-red-400">
                {t("batchEntry.failedReasonsTitle", { count: String(failedReasons.length) })}
              </p>
              <ul className="max-h-40 list-inside list-disc space-y-1 overflow-y-auto text-xs text-[var(--color-light)]">
                {failedReasons.map(({ name, reason }, idx) => (
                  <li key={`${idx}-${name}`}>
                    <span className="font-medium text-[var(--color-lightest)]">{name}</span>: {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!parseResult?.ok && !loadingParse && (
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
        </div>
      )}
    </div>
  );
}
