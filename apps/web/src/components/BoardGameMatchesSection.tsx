import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { BoardGameMatch, BoardGameMatchPlayer, Log } from "@geeklogs/shared";
import { DEFAULT_BOARD_GAME_SESSION_DURATION_HOURS, type BoardGameSessionDurationHours } from "@geeklogs/shared";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select } from "@/components/ui/select";
import { Logo } from "@/components/Logo";
import { apiFetch, invalidateLogsAndItemsCache } from "@/lib/api";
import { useLocale, type TFunction } from "@/contexts/LocaleContext";
import { useMe } from "@/contexts/MeContext";
import { showErrorToast } from "@/lib/errorToast";
import { toast } from "sonner";
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  ChevronDown,
  Clock,
  Dice5,
  Loader2,
  Trash2,
  Trophy,
  User,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { boardGameSessionDurationLabel, boardGameSessionDurationOptions } from "@/lib/boardGameSessionDuration";

type PlayerRow = { name: string; score: string; winner: boolean; appUserId?: string | null };

type MeUser = NonNullable<ReturnType<typeof useMe>["me"]>["user"];

function buildDefaultPlayers(meUser: MeUser | undefined): PlayerRow[] {
  const selfName = meUser?.username?.trim() || meUser?.email?.trim() || "";
  return [
    { name: selfName, score: "", winner: false, appUserId: meUser?.id ?? null },
    { name: "", score: "", winner: false, appUserId: null },
  ];
}

/** Oldest session first — used to find each match’s immediate predecessor in time. */
function sortBoardGameMatchesChronologicalAsc(list: BoardGameMatch[]): BoardGameMatch[] {
  return [...list].sort((a, b) => {
    const ta = Date.parse(a.playedAt);
    const tb = Date.parse(b.playedAt);
    if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
    const ca = Date.parse(a.createdAt);
    const cb = Date.parse(b.createdAt);
    if (Number.isFinite(ca) && Number.isFinite(cb) && ca !== cb) return ca - cb;
    return a.id.localeCompare(b.id);
  });
}

function getChronologicalPreviousMatch(chronAsc: BoardGameMatch[], match: BoardGameMatch): BoardGameMatch | null {
  const idx = chronAsc.findIndex((m) => m.id === match.id);
  if (idx <= 0) return null;
  return chronAsc[idx - 1] ?? null;
}

function boardGamePlayerIdentityKey(p: BoardGameMatchPlayer): string {
  const id = p.appUserId?.trim();
  if (id) return `id:${id}`;
  return `n:${p.name.trim().toLowerCase()}`;
}

function findPreviousSessionScore(previousMatch: BoardGameMatch, player: BoardGameMatchPlayer): number | null {
  const key = boardGamePlayerIdentityKey(player);
  const prev = previousMatch.players.find((q) => boardGamePlayerIdentityKey(q) === key);
  const s = prev?.score;
  if (s == null || typeof s !== "number" || !Number.isFinite(s)) return null;
  return s;
}

type ScoreTrendVsPrevious = "higher" | "lower";

function scoreTrendVsPreviousSession(
  player: BoardGameMatchPlayer,
  previousMatch: BoardGameMatch | null
): ScoreTrendVsPrevious | null {
  if (!previousMatch) return null;
  const cur = player.score;
  if (cur == null || typeof cur !== "number" || !Number.isFinite(cur)) return null;
  const prevScore = findPreviousSessionScore(previousMatch, player);
  if (prevScore == null) return null;
  if (cur > prevScore) return "higher";
  if (cur < prevScore) return "lower";
  return null;
}

function todayDateInput(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isTodayDateInput(yyyyMmDd: string): boolean {
  return yyyyMmDd === todayDateInput();
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

function initialsFromName(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]![0] ?? "";
    const b = parts[parts.length - 1]![0] ?? "";
    return (a + b).toUpperCase() || "?";
  }
  return t.slice(0, 2).toUpperCase() || "?";
}

function huesFromName(name: string): { h1: number; h2: number } {
  let h = 0;
  const s = name.trim() || "?";
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const h1 = h % 360;
  const h2 = (h1 + 48) % 360;
  return { h1, h2 };
}

function PlayerAvatar({
  name,
  size = "md",
  winner,
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  winner?: boolean;
  className?: string;
}) {
  const initials = initialsFromName(name);
  const { h1, h2 } = huesFromName(name);
  const sizeClass =
    size === "sm" ? "h-9 w-9 min-h-9 min-w-9 text-[11px]" : size === "lg" ? "h-14 w-14 min-h-14 min-w-14 text-lg" : "h-11 w-11 min-h-11 min-w-11 text-sm";

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold tracking-tight text-white shadow-md ring-1 ring-white/15",
        sizeClass,
        winner &&
          "ring-2 ring-amber-400/95 ring-offset-2 ring-offset-[var(--color-darkest)] shadow-[0_0_18px_-2px_rgba(251,191,36,0.55)]",
        className
      )}
      style={{
        background: `linear-gradient(145deg, hsl(${h1} 58% 48%) 0%, hsl(${h2} 52% 36%) 100%)`,
      }}
      aria-hidden
    >
      {initials}
    </div>
  );
}

function MatchPlayerNameField({
  value,
  appUserId,
  onChange,
  excludeUserId,
  t,
}: {
  value: string;
  appUserId?: string | null;
  onChange: (next: { name: string; appUserId?: string | null }) => void;
  excludeUserId?: string;
  t: TFunction;
}) {
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState(value);
  const [loading, setLoading] = useState(false);
  const [appHits, setAppHits] = useState<{ id: string; username?: string }[]>([]);
  const [customHits, setCustomHits] = useState<{ id: string; label: string }[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fetchGen = useRef(0);

  useEffect(() => {
    const h = setTimeout(() => setDebounced(value), 220);
    return () => clearTimeout(h);
  }, [value]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      const el = wrapRef.current;
      if (!el || el.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const q = debounced.trim();
    const gen = ++fetchGen.current;
    setLoading(true);
    void (async () => {
      try {
        const customPath = q
          ? `/me/board-game-custom-opponents?q=${encodeURIComponent(q)}`
          : "/me/board-game-custom-opponents";
        const [customRes, userRes] = await Promise.all([
          apiFetch<{ data: { id: string; label: string }[] }>(customPath),
          q.length >= 1
            ? apiFetch<{ users: { id: string; username?: string }[] }>(`/search/users?q=${encodeURIComponent(q)}`)
            : Promise.resolve({ users: [] as { id: string; username?: string }[] }),
        ]);
        if (gen !== fetchGen.current) return;
        setCustomHits(customRes.data ?? []);
        const users = (userRes.users ?? []).filter((u) => u.id !== excludeUserId && u.username);
        setAppHits(users);
      } catch {
        if (gen !== fetchGen.current) return;
        setCustomHits([]);
        setAppHits([]);
      } finally {
        if (gen === fetchGen.current) setLoading(false);
      }
    })();
  }, [open, debounced, excludeUserId]);

  const trimmed = value.trim();
  const showSuggestions = open && (loading || appHits.length > 0 || customHits.length > 0 || trimmed.length > 0);

  return (
    <div ref={wrapRef} className="relative min-w-0">
      <Input
        placeholder={t("boardGameMatches.playerName")}
        value={value}
        onChange={(e) => onChange({ name: e.target.value, appUserId: null })}
        onFocus={() => setOpen(true)}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={showSuggestions}
        className="border-[var(--color-mid)]/35 bg-[var(--color-dark)]/80"
        aria-label={t("boardGameMatches.playerName")}
      />
      {showSuggestions && (
        <div
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-[var(--color-mid)]/35 bg-[var(--color-darkest)] py-1 shadow-xl ring-1 ring-black/20"
        >
          {loading && (
            <div className="flex items-center justify-center gap-2 px-3 py-2.5 text-xs text-[var(--color-light)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
            </div>
          )}
          {!loading && appHits.length > 0 && (
            <div className="px-2 pt-1">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-light)]/80">
                {t("boardGameMatches.suggestionsAppMembers")}
              </p>
              {appHits.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  role="option"
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm text-[var(--color-lightest)] hover:bg-[var(--color-mid)]/20",
                    appUserId === u.id && "bg-[var(--color-mid)]/15 ring-1 ring-[var(--btn-gradient-start)]/25"
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange({ name: u.username ?? "", appUserId: u.id });
                    setOpen(false);
                  }}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-mid)]/25 p-1 ring-1 ring-[var(--color-mid)]/30">
                    <Logo className="h-5 w-5 object-contain" alt="" />
                  </span>
                  <span className="min-w-0 truncate font-medium">{u.username}</span>
                </button>
              ))}
            </div>
          )}
          {!loading && customHits.length > 0 && (
            <div className="px-2 pt-1">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-light)]/80">
                {t("boardGameMatches.suggestionsSavedNames")}
              </p>
              {customHits.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm text-[var(--color-lightest)] hover:bg-[var(--color-mid)]/20"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange({ name: c.label, appUserId: null });
                    setOpen(false);
                  }}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-mid)]/20 text-[var(--color-light)] ring-1 ring-[var(--color-mid)]/25">
                    <User className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 truncate font-medium">{c.label}</span>
                </button>
              ))}
            </div>
          )}
          {trimmed.length > 0 && (
            <div className="border-t border-[var(--color-mid)]/20 px-2 py-1">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-[var(--color-light)] hover:bg-[var(--color-mid)]/15 hover:text-[var(--color-lightest)]"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange({ name: trimmed, appUserId: null });
                  setOpen(false);
                }}
              >
                {t("boardGameMatches.useTypedAsCustom", { name: trimmed })}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export type BoardGameMatchesSectionHandle = {
  saveNewMatch: () => Promise<boolean>;
};

export const BoardGameMatchesSection = forwardRef<
  BoardGameMatchesSectionHandle,
  {
    /** When null, only the new-match form is shown until `onEnsureLog` creates a log. */
    logId: string | null;
    onLogUpdated: (log: Log) => void;
    /** Creates a board-game log when saving the first match without an existing review. */
    onEnsureLog?: () => Promise<string>;
    /** When true, hide the section save button (parent provides one). */
    embedded?: boolean;
    /** Called after a match is saved (e.g. close drawer/modal). */
    onMatchSaved?: (log: Log) => void;
  }
>(function BoardGameMatchesSection({ logId, onLogUpdated, onEnsureLog, embedded = false, onMatchSaved }, ref) {
  const { t, locale } = useLocale();
  const { me } = useMe();
  const meUser = me?.user;
  const [matches, setMatches] = useState<BoardGameMatch[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [playedDate, setPlayedDate] = useState(todayDateInput);
  const [sessionDurationHours, setSessionDurationHours] = useState<BoardGameSessionDurationHours>(
    DEFAULT_BOARD_GAME_SESSION_DURATION_HOURS
  );
  const [players, setPlayers] = useState<PlayerRow[]>(() => buildDefaultPlayers(undefined));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmMatchId, setDeleteConfirmMatchId] = useState<string | null>(null);
  const playedDateInputRef = useRef<HTMLInputElement>(null);
  const isPlayedToday = isTodayDateInput(playedDate);

  const matchesChronologicalAsc = useMemo(() => sortBoardGameMatchesChronologicalAsc(matches), [matches]);

  useEffect(() => {
    if (!meUser?.id) return;
    setPlayers((prev) => {
      const first = prev[0];
      if (first?.appUserId === meUser.id && first.name.trim()) return prev;
      if (first?.name.trim() || first?.appUserId) return prev;
      const defaults = buildDefaultPlayers(meUser);
      return [defaults[0]!, ...prev.slice(1)];
    });
  }, [meUser?.id, meUser?.username, meUser?.email]);

  const loadMatches = useCallback(() => {
    if (!logId) {
      setMatches([]);
      setLoadingList(false);
      return;
    }
    setLoadingList(true);
    apiFetch<{ data: BoardGameMatch[] }>(`/logs/${logId}/board-game-matches`)
      .then((res) => setMatches(res.data ?? []))
      .catch(() => setMatches([]))
      .finally(() => setLoadingList(false));
  }, [logId]);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  const resetForm = useCallback(() => {
    setPlayedDate(todayDateInput());
    setSessionDurationHours(DEFAULT_BOARD_GAME_SESSION_DURATION_HOURS);
    setPlayers(buildDefaultPlayers(meUser));
    setNotes("");
  }, [meUser]);

  const submitNewMatch = useCallback(
    async (
      iso: string,
      durationHours: BoardGameSessionDurationHours,
      playersPayload: Array<{ name: string; score: number | null; winner: boolean; appUserId?: string }>,
      matchNotes: string | null,
      options?: { resetAfter?: boolean },
    ): Promise<boolean> => {
      setSaving(true);
      try {
        let targetLogId = logId;
        if (!targetLogId) {
          if (!onEnsureLog) {
            toast.error(t("boardGameMatches.needLogFirst"));
            return false;
          }
          targetLogId = await onEnsureLog();
        }
        const res = await apiFetch<{ match: BoardGameMatch; log: Log }>(`/logs/${targetLogId}/board-game-matches`, {
          method: "POST",
          body: JSON.stringify({
            playedAt: iso,
            durationHours,
            players: playersPayload.map((p) => ({
              name: p.name,
              score: p.score,
              winner: p.winner,
              ...(p.appUserId ? { appUserId: p.appUserId } : {}),
            })),
            notes: matchNotes,
          }),
        });
        invalidateLogsAndItemsCache();
        onLogUpdated(res.log);
        setMatches((prev) => [res.match, ...prev]);
        if (options?.resetAfter) resetForm();
        onMatchSaved?.(res.log);
        toast.success(t("boardGameMatches.saved"));
        return true;
      } catch (err) {
        showErrorToast(t, "E013", { originalError: err });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [logId, onEnsureLog, onLogUpdated, onMatchSaved, resetForm, t],
  );

  const handleSaveNew = useCallback(async (): Promise<boolean> => {
    const iso = dateInputToIso(playedDate);
    if (!iso) {
      toast.error(t("boardGameMatches.invalidDate"));
      return false;
    }
    const trimmed = players.map((p) => ({
      name: p.name.trim(),
      score: p.score.trim() === "" ? null : Number(p.score),
      winner: p.winner,
      appUserId: p.appUserId?.trim() ? p.appUserId.trim() : undefined,
    }));
    const withNames = trimmed.filter((p) => p.name.length > 0);
    if (withNames.length === 0) {
      toast.error(t("boardGameMatches.needPlayerName"));
      return false;
    }
    for (const p of withNames) {
      if (p.score != null && !Number.isFinite(p.score)) {
        toast.error(t("boardGameMatches.invalidScore"));
        return false;
      }
    }
    return submitNewMatch(
      iso,
      sessionDurationHours,
      withNames.map((p) => ({
        name: p.name,
        score: p.score,
        winner: p.winner,
        appUserId: p.appUserId,
      })),
      notes.trim() || null,
      { resetAfter: true },
    );
  }, [notes, playedDate, players, sessionDurationHours, submitNewMatch, t]);

  useImperativeHandle(ref, () => ({ saveNewMatch: handleSaveNew }), [handleSaveNew]);

  const performDeleteMatch = useCallback(
    async (matchId: string) => {
      if (!logId) return;
      setDeletingId(matchId);
      try {
        const res = await apiFetch<{ log: Log }>(`/logs/${logId}/board-game-matches/${matchId}`, {
          method: "DELETE",
        });
        invalidateLogsAndItemsCache();
        onLogUpdated(res.log);
        setMatches((prev) => prev.filter((m) => m.id !== matchId));
        setDeleteConfirmMatchId(null);
        toast.success(t("boardGameMatches.deleted"));
      } catch (err) {
        showErrorToast(t, "E013", { originalError: err });
      } finally {
        setDeletingId(null);
      }
    },
    [logId, onLogUpdated, t],
  );

  const formatPlayed = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-col gap-4">
          <div className="flex min-w-0 flex-wrap items-end gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-lightest)]">
                <Calendar className="h-3.5 w-3.5 text-[var(--color-light)]" aria-hidden />
                {t("boardGameMatches.playedDate")}
              </Label>
              {isPlayedToday ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 min-w-[8rem] justify-start border-[var(--color-mid)]/40 bg-[var(--color-darkest)]/80 px-3 font-normal text-[var(--color-lightest)] hover:bg-[var(--color-mid)]/15"
                  onClick={() => playedDateInputRef.current?.showPicker()}
                  aria-label={t("boardGameMatches.playedDate")}
                >
                  {t("boardGameMatches.today")}
                </Button>
              ) : (
                <Input
                  type="date"
                  value={playedDate}
                  onChange={(e) => setPlayedDate(e.target.value)}
                  className="max-w-[14rem] border-[var(--color-mid)]/40 bg-[var(--color-darkest)]/80"
                  aria-label={t("boardGameMatches.playedDate")}
                />
              )}
              <input
                ref={playedDateInputRef}
                type="date"
                tabIndex={-1}
                value={playedDate}
                onChange={(e) => setPlayedDate(e.target.value)}
                className={cn(
                  "max-w-[14rem] border-[var(--color-mid)]/40 bg-[var(--color-darkest)]/80",
                  isPlayedToday ? "pointer-events-none absolute h-px w-px overflow-hidden opacity-0" : "hidden",
                )}
                aria-hidden={isPlayedToday}
              />
            </div>
            <div className="min-w-0 space-y-2 sm:min-w-[10rem]">
              <Label className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-lightest)]">
                <Clock className="h-3.5 w-3.5 text-[var(--color-light)]" aria-hidden />
                {t("boardGameMatches.sessionDuration")}
              </Label>
              <Select
                value={String(sessionDurationHours)}
                onValueChange={(v) => setSessionDurationHours(Number(v) as BoardGameSessionDurationHours)}
                options={boardGameSessionDurationOptions(t)}
                aria-label={t("boardGameMatches.sessionDuration")}
                className="w-full min-w-[10rem] max-w-[14rem]"
                triggerClassName="w-full min-w-0"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-lightest)]">
                <Dice5 className="h-3.5 w-3.5 text-[var(--color-light)]" aria-hidden />
                {t("boardGameMatches.players")}
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-full border-[var(--color-mid)]/40 bg-[var(--color-dark)]/60 hover:bg-[var(--color-mid)]/20"
                onClick={() => setPlayers((prev) => [...prev, { name: "", score: "", winner: false, appUserId: null }])}
              >
                <UserPlus className="h-3.5 w-3.5" aria-hidden />
                {t("boardGameMatches.addPlayer")}
              </Button>
            </div>
            {players.map((p, i) => (
              <motion.div
                key={i}
                layout
                className="flex min-w-0 flex-wrap items-center gap-2 border-b border-[var(--color-mid)]/20 pb-3 last:border-b-0 last:pb-0 sm:gap-3"
              >
                <div className="relative shrink-0">
                  <PlayerAvatar name={p.name || "?"} size="md" winner={p.winner} />
                  {p.appUserId && (
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-md bg-[var(--color-darkest)] p-0.5 ring-2 ring-[var(--color-dark)]">
                      <Logo className="h-3.5 w-3.5 object-contain" alt="" />
                    </span>
                  )}
                </div>
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-light)] sm:text-xs">
                  {t("boardGameMatches.playerSlot", { n: String(i + 1) })}
                </span>
                <div className="min-w-[8rem] flex-1 basis-[10rem]">
                  <MatchPlayerNameField
                    value={p.name}
                    appUserId={p.appUserId}
                    excludeUserId={i === 0 ? undefined : meUser?.id}
                    t={t}
                    onChange={(next) =>
                      setPlayers((prev) => prev.map((row, j) => (j === i ? { ...row, ...next } : row)))
                    }
                  />
                </div>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder={t("boardGameMatches.score")}
                  value={p.score}
                  onChange={(e) =>
                    setPlayers((prev) => prev.map((row, j) => (j === i ? { ...row, score: e.target.value } : row)))
                  }
                  className="h-10 w-[5.5rem] shrink-0 border-[var(--color-mid)]/35 bg-[var(--color-dark)]/80"
                  aria-label={t("boardGameMatches.score")}
                />
                <div className="flex shrink-0 items-center gap-2 rounded-xl bg-[var(--color-mid)]/10 px-2.5 py-1.5">
                  <Switch
                    checked={p.winner}
                    onCheckedChange={(v) =>
                      setPlayers((prev) => prev.map((row, j) => (j === i ? { ...row, winner: v } : row)))
                    }
                    aria-label={t("boardGameMatches.winner")}
                  />
                  <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-400/90" aria-hidden />
                  <span className="hidden text-xs font-medium text-[var(--color-light)] sm:inline">
                    {t("boardGameMatches.winner")}
                  </span>
                </div>
                {players.length > 1 && i > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="ml-auto shrink-0 text-red-400/90 hover:bg-red-500/15 hover:text-red-300 sm:ml-0"
                    onClick={() => setPlayers((prev) => prev.filter((_, j) => j !== i))}
                    aria-label={t("boardGameMatches.removePlayer")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </motion.div>
            ))}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-[var(--color-lightest)]">{t("boardGameMatches.matchNotes")}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={t("boardGameMatches.matchNotesPlaceholder")}
              className="min-h-[88px] resize-none border-[var(--color-mid)]/35 bg-[var(--color-dark)]/80"
            />
          </div>

          {!embedded && (
            <Button
              type="button"
              className="w-full"
              disabled={saving}
              onClick={() => void handleSaveNew()}
            >
              {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden /> : <Dice5 className="mr-2 h-5 w-5 opacity-90" aria-hidden />}
              {saving ? t("common.saving") : t("boardGameMatches.saveMatch")}
            </Button>
          )}
      </div>

      {logId ? (
        <div className="flex min-w-0 flex-col gap-4 border-t border-[var(--color-mid)]/25 pt-4">
          <div>
            <h3 className="text-sm font-medium text-[var(--color-lightest)]">{t("boardGameMatches.previousSessions")}</h3>
            <p className="mt-1 text-xs text-[var(--color-light)]">{t("boardGameMatches.playHistorySubtitle")}</p>
          </div>
          {loadingList ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--btn-gradient-start)]" aria-hidden />
            </div>
          ) : matches.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-mid)]/40 bg-[var(--color-mid)]/5 px-6 py-10 text-center"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-dark)] text-[var(--color-light)] ring-1 ring-[var(--color-mid)]/30">
                <Dice5 className="h-7 w-7" aria-hidden />
              </span>
              <p className="max-w-sm text-sm text-[var(--color-light)]">{t("boardGameMatches.noMatchesYet")}</p>
            </motion.div>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {matches.map((m, i) => (
                <motion.li
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.24), type: "spring", stiffness: 380, damping: 28 }}
                >
                  <MatchHistoryCard
                    match={m}
                    previousMatch={getChronologicalPreviousMatch(matchesChronologicalAsc, m)}
                    formatPlayed={formatPlayed}
                    deleting={deletingId === m.id}
                    onDelete={() => setDeleteConfirmMatchId(m.id)}
                    t={t}
                  />
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <Dialog
        open={deleteConfirmMatchId != null}
        onOpenChange={(open) => {
          if (!open && !deletingId) setDeleteConfirmMatchId(null);
        }}
      >
        <DialogContent
          className="z-[60] sm:max-w-sm"
          overlayClassName="z-[60]"
          onClose={() => {
            if (!deletingId) setDeleteConfirmMatchId(null);
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-[var(--color-lightest)]">
              {t("boardGameMatches.removeSession")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--color-light)]">{t("boardGameMatches.deleteConfirm")}</p>
          <div className="flex gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              disabled={deletingId != null}
              onClick={() => setDeleteConfirmMatchId(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deletingId != null || deleteConfirmMatchId == null}
              onClick={() => {
                if (deleteConfirmMatchId) void performDeleteMatch(deleteConfirmMatchId);
              }}
            >
              {deletingId != null ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  {t("common.deleting")}
                </>
              ) : (
                t("common.delete")
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});

function MatchHistoryCard({
  match,
  previousMatch,
  formatPlayed,
  deleting,
  onDelete,
  t,
}: {
  match: BoardGameMatch;
  /** Chronologically earlier session for this log (same game), if any. */
  previousMatch: BoardGameMatch | null;
  formatPlayed: (iso: string) => string;
  deleting: boolean;
  onDelete: () => void;
  t: TFunction;
}) {
  const [open, setOpen] = useState(false);
  const winners = match.players.filter((p) => p.winner).map((p) => p.name);

  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--color-mid)]/25 bg-gradient-to-br from-[var(--color-dark)] via-[var(--color-dark)] to-[var(--color-darkest)] shadow-[var(--shadow-md)] ring-1 ring-white/[0.04]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full min-h-[52px] items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[var(--color-mid)]/10 sm:gap-4 sm:px-5 sm:py-4"
        aria-expanded={open}
      >
        <div className="flex shrink-0 -space-x-2.5">
          {match.players.slice(0, 5).map((p, i) => (
            <div key={i} className="relative ring-2 ring-[var(--color-dark)] rounded-full" style={{ zIndex: 10 - i }}>
              <PlayerAvatar name={p.name || "?"} size="sm" winner={false} />
            </div>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-mid)]/25 px-2.5 py-1 text-xs font-semibold text-[var(--color-lightest)] ring-1 ring-[var(--color-mid)]/20">
              <Calendar className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
              {formatPlayed(match.playedAt)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-mid)]/15 px-2.5 py-1 text-xs font-medium text-[var(--color-light)] ring-1 ring-[var(--color-mid)]/20">
              <Clock className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
              {boardGameSessionDurationLabel(
                (match.durationHours ?? DEFAULT_BOARD_GAME_SESSION_DURATION_HOURS) as BoardGameSessionDurationHours,
                t
              )}
            </span>
            {winners.length > 0 && (
              <span className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-200/95 ring-1 ring-amber-400/25">
                <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />
                <span className="truncate">{winners.join(" · ")}</span>
              </span>
            )}
          </div>
        </div>
        <ChevronDown
          className={cn("h-5 w-5 shrink-0 text-[var(--color-light)] transition-transform duration-200", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open && (
        <div className="space-y-4 border-t border-[var(--color-mid)]/20 px-4 pb-4 pt-3 sm:px-5">
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {match.players.map((p, i) => {
              const scoreTrend = scoreTrendVsPreviousSession(p, previousMatch);
              return (
                <li
                  key={i}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-3 py-2.5 sm:gap-4 sm:px-4 sm:py-3",
                    p.winner
                      ? "border-amber-400/35 bg-gradient-to-r from-amber-500/10 to-transparent"
                      : "border-[var(--color-mid)]/15 bg-[var(--color-mid)]/5"
                  )}
                >
                  <PlayerAvatar name={p.name} size="md" winner={p.winner} />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      {p.appUserId && (
                        <Logo className="h-4 w-4 shrink-0 object-contain opacity-95" alt="" aria-hidden />
                      )}
                      <div className="truncate font-medium text-[var(--color-lightest)]">{p.name}</div>
                    </div>
                    {p.score != null && (
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm tabular-nums text-[var(--color-light)]">
                        <span>
                          {p.score}{" "}
                          <span className="text-xs font-normal opacity-80">{t("boardGameMatches.points")}</span>
                        </span>
                        {scoreTrend === "higher" && (
                          <span
                            className="inline-flex shrink-0"
                            title={t("boardGameMatches.scoreTrendHigherTitle")}
                            aria-label={t("boardGameMatches.scoreTrendHigherAria")}
                          >
                            <ArrowUpRight className="h-4 w-4 text-emerald-400/95" strokeWidth={2.25} aria-hidden />
                          </span>
                        )}
                        {scoreTrend === "lower" && (
                          <span
                            className="inline-flex shrink-0"
                            title={t("boardGameMatches.scoreTrendLowerTitle")}
                            aria-label={t("boardGameMatches.scoreTrendLowerAria")}
                          >
                            <ArrowDownRight className="h-4 w-4 text-rose-400/95" strokeWidth={2.25} aria-hidden />
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {p.winner && <Trophy className="h-5 w-5 shrink-0 text-amber-400" aria-hidden />}
                </li>
              );
            })}
          </ul>
          {match.notes && match.notes.trim() !== "" && (
            <div className="rounded-xl border border-[var(--color-mid)]/15 bg-[var(--color-darkest)]/60 px-4 py-3">
              <p className="m-0 whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-light)]">{match.notes}</p>
            </div>
          )}
          <div className="flex justify-end pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 rounded-full border-red-500/35 text-red-400 hover:bg-red-500/10 hover:text-red-300"
              disabled={deleting}
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
              {t("boardGameMatches.removeSession")}
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}
