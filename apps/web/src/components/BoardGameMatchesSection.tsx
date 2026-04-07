import { useCallback, useEffect, useState } from "react";
import type { BoardGameMatch, Log } from "@geeklogs/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { apiFetch, invalidateLogsAndItemsCache } from "@/lib/api";
import { useLocale } from "@/contexts/LocaleContext";
import { showErrorToast } from "@/lib/errorToast";
import { toast } from "sonner";
import { ChevronRight, Loader2, Trash2, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

type PlayerRow = { name: string; score: string; winner: boolean };

function todayDateInput(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateInputToIso(yyyyMmDd: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd.trim());
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d, 12, 0, 0, 0);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt.toISOString();
}

export function BoardGameMatchesSection({
  logId,
  onLogUpdated,
}: {
  logId: string;
  onLogUpdated: (log: Log) => void;
}) {
  const { t, locale } = useLocale();
  const [matches, setMatches] = useState<BoardGameMatch[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [playedDate, setPlayedDate] = useState(todayDateInput);
  const [players, setPlayers] = useState<PlayerRow[]>([
    { name: "", score: "", winner: false },
    { name: "", score: "", winner: false },
  ]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadMatches = useCallback(() => {
    setLoadingList(true);
    apiFetch<{ data: BoardGameMatch[] }>(`/logs/${logId}/board-game-matches`)
      .then((res) => setMatches(res.data ?? []))
      .catch(() => setMatches([]))
      .finally(() => setLoadingList(false));
  }, [logId]);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  const resetForm = () => {
    setPlayedDate(todayDateInput());
    setPlayers([
      { name: "", score: "", winner: false },
      { name: "", score: "", winner: false },
    ]);
    setNotes("");
  };

  const handleSaveNew = async () => {
    const iso = dateInputToIso(playedDate);
    if (!iso) {
      toast.error(t("boardGameMatches.invalidDate"));
      return;
    }
    const trimmed = players.map((p) => ({
      name: p.name.trim(),
      score: p.score.trim() === "" ? null : Number(p.score),
      winner: p.winner,
    }));
    const withNames = trimmed.filter((p) => p.name.length > 0);
    if (withNames.length === 0) {
      toast.error(t("boardGameMatches.needPlayerName"));
      return;
    }
    for (const p of withNames) {
      if (p.score != null && !Number.isFinite(p.score)) {
        toast.error(t("boardGameMatches.invalidScore"));
        return;
      }
    }
    setSaving(true);
    try {
      const res = await apiFetch<{ match: BoardGameMatch; log: Log }>(`/logs/${logId}/board-game-matches`, {
        method: "POST",
        body: JSON.stringify({
          playedAt: iso,
          players: withNames.map((p) => ({
            name: p.name,
            score: p.score,
            winner: p.winner,
          })),
          notes: notes.trim() || null,
        }),
      });
      invalidateLogsAndItemsCache();
      onLogUpdated(res.log);
      setMatches((prev) => [res.match, ...prev]);
      resetForm();
      toast.success(t("boardGameMatches.saved"));
    } catch (err) {
      showErrorToast(t, "E013", { originalError: err });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (matchId: string) => {
    if (!window.confirm(t("boardGameMatches.deleteConfirm"))) return;
    setDeletingId(matchId);
    try {
      const res = await apiFetch<{ log: Log }>(`/logs/${logId}/board-game-matches/${matchId}`, {
        method: "DELETE",
      });
      invalidateLogsAndItemsCache();
      onLogUpdated(res.log);
      setMatches((prev) => prev.filter((m) => m.id !== matchId));
      toast.success(t("boardGameMatches.deleted"));
    } catch (err) {
      showErrorToast(t, "E013", { originalError: err });
    } finally {
      setDeletingId(null);
    }
  };

  const formatPlayed = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-light)]">
          {t("boardGameMatches.previousSessions")}
        </h3>
        {loadingList ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--color-mid)]" aria-hidden />
          </div>
        ) : matches.length === 0 ? (
          <p className="text-sm text-[var(--color-light)]">{t("boardGameMatches.noMatchesYet")}</p>
        ) : (
          <ul className="flex flex-col gap-2 p-0 m-0 list-none">
            {matches.map((m) => (
              <MatchHistoryCard
                key={m.id}
                match={m}
                formatPlayed={formatPlayed}
                deleting={deletingId === m.id}
                onDelete={() => handleDelete(m.id)}
                t={t}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-[var(--color-surface-border)] pt-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-light)]">
          {t("boardGameMatches.newMatch")}
        </h3>
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label className="text-[var(--color-lightest)]">{t("boardGameMatches.playedDate")}</Label>
            <Input
              type="date"
              value={playedDate}
              onChange={(e) => setPlayedDate(e.target.value)}
              className="max-w-[12rem]"
              aria-label={t("boardGameMatches.playedDate")}
            />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-[var(--color-lightest)]">{t("boardGameMatches.players")}</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => setPlayers((prev) => [...prev, { name: "", score: "", winner: false }])}
              >
                <UserPlus className="h-3.5 w-3.5" aria-hidden />
                {t("boardGameMatches.addPlayer")}
              </Button>
            </div>
            {players.map((p, i) => (
              <div
                key={i}
                className="grid grid-cols-1 gap-2 rounded-lg border border-[var(--color-mid)]/25 bg-[var(--color-darkest)]/40 p-3 sm:grid-cols-[1fr_6rem_auto_auto]"
              >
                <Input
                  placeholder={t("boardGameMatches.playerName")}
                  value={p.name}
                  onChange={(e) =>
                    setPlayers((prev) => prev.map((row, j) => (j === i ? { ...row, name: e.target.value } : row)))
                  }
                  aria-label={t("boardGameMatches.playerName")}
                />
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder={t("boardGameMatches.score")}
                  value={p.score}
                  onChange={(e) =>
                    setPlayers((prev) => prev.map((row, j) => (j === i ? { ...row, score: e.target.value } : row)))
                  }
                  aria-label={t("boardGameMatches.score")}
                />
                <div className="flex items-center gap-2 sm:justify-center">
                  <Switch
                    checked={p.winner}
                    onCheckedChange={(v) =>
                      setPlayers((prev) => prev.map((row, j) => (j === i ? { ...row, winner: v } : row)))
                    }
                    aria-label={t("boardGameMatches.winner")}
                  />
                  <span className="text-xs text-[var(--color-light)]">{t("boardGameMatches.winner")}</span>
                </div>
                {players.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-red-400 hover:bg-red-500/20"
                    onClick={() => setPlayers((prev) => prev.filter((_, j) => j !== i))}
                    aria-label={t("boardGameMatches.removePlayer")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Label className="text-[var(--color-lightest)]">{t("boardGameMatches.matchNotes")}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={t("boardGameMatches.matchNotesPlaceholder")}
              className="min-h-[72px]"
            />
          </div>
          <Button type="button" className="w-full sm:w-auto" disabled={saving} onClick={() => void handleSaveNew()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {saving ? t("common.saving") : t("boardGameMatches.saveMatch")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MatchHistoryCard({
  match,
  formatPlayed,
  deleting,
  onDelete,
  t,
}: {
  match: BoardGameMatch;
  formatPlayed: (iso: string) => string;
  deleting: boolean;
  onDelete: () => void;
  t: (k: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const winners = match.players.filter((p) => p.winner).map((p) => p.name);

  return (
    <li className="overflow-hidden rounded-lg border border-[var(--color-mid)]/25 bg-[var(--color-darkest)]/30">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full min-h-[44px] items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--color-mid)]/15"
        aria-expanded={open}
      >
        <ChevronRight
          className={cn("h-4 w-4 shrink-0 text-[var(--color-light)] transition-transform", open && "rotate-90")}
          aria-hidden
        />
        <span className="text-sm font-medium text-[var(--color-lightest)]">{formatPlayed(match.playedAt)}</span>
        {winners.length > 0 && (
          <span className="min-w-0 truncate text-xs text-[var(--color-mid)]">
            {t("boardGameMatches.winners")}: {winners.join(", ")}
          </span>
        )}
      </button>
      {open && (
        <div className="border-t border-[var(--color-mid)]/20 px-3 py-3 space-y-3">
          <ul className="m-0 list-none space-y-1 p-0 text-sm text-[var(--color-light)]">
            {match.players.map((p, i) => (
              <li key={i}>
                <span className="font-medium text-[var(--color-lightest)]">{p.name}</span>
                {p.score != null && <span className="tabular-nums"> — {p.score}</span>}
                {p.winner && (
                  <span className="ml-1 text-[var(--color-mid)]">({t("boardGameMatches.winner")})</span>
                )}
              </li>
            ))}
          </ul>
          {match.notes && match.notes.trim() !== "" && (
            <p className="whitespace-pre-wrap text-sm text-[var(--color-light)]">{match.notes}</p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-red-400 border-red-500/40 hover:bg-red-500/10"
            disabled={deleting}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            <span className="ml-1">{t("boardGameMatches.removeSession")}</span>
          </Button>
        </div>
      )}
    </li>
  );
}
