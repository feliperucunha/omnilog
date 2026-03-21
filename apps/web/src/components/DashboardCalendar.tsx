import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useLocale } from "@/contexts/LocaleContext";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { ItemImage } from "@/components/ItemImage";
import { Skeleton } from "@/components/ui/skeleton";
import { StarRating } from "@/components/StarRating";
import { gradeToStars } from "@/lib/gradeStars";
import { formatTimeToFinish } from "@/lib/formatDuration";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerFooter } from "@/components/ui/drawer";
import { IN_PROGRESS_STATUSES, type Log } from "@geeklogs/shared";

const paperShadow = { boxShadow: "var(--shadow-sm)" };

const WEEKDAY_KEYS = [
  "dashboard.calendarMon",
  "dashboard.calendarTue",
  "dashboard.calendarWed",
  "dashboard.calendarThu",
  "dashboard.calendarFri",
  "dashboard.calendarSat",
  "dashboard.calendarSun",
] as const;

interface CalendarData {
  year: number;
  month: number;
  dates: Record<string, number>;
}

function getMonthKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatCalendarDayDate(dateKey: string, locale: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export function DashboardCalendar({ isPro }: { isPro: boolean }) {
  const { t, locale } = useLocale();
  const isMobile = useIsMobile();
  const drawerCloseRef = useRef<(() => void) | null>(null);
  const drawerCloseImmediatelyRef = useRef<(() => void) | null>(null);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayLogs, setDayLogs] = useState<Log[]>([]);
  const [dayLogsLoading, setDayLogsLoading] = useState(false);

  const tzOffsetMinutes = useMemo(() => -new Date().getTimezoneOffset(), []);

  const fetchCalendar = useCallback(async (y: number, m: number) => {
    if (!isPro) return;
    setLoading(true);
    try {
      const res = await apiFetch<CalendarData>(
        `/logs/calendar?year=${y}&month=${m}&timezoneOffsetMinutes=${tzOffsetMinutes}`
      );
      setData(res);
    } catch {
      setData({ year: y, month: m, dates: {} });
    } finally {
      setLoading(false);
    }
  }, [isPro, tzOffsetMinutes]);

  useEffect(() => {
    if (!isPro) {
      setData(null);
      setLoading(false);
      return;
    }
    void fetchCalendar(year, month);
  }, [isPro, year, month, fetchCalendar]);

  const fetchDayLogs = useCallback(async (dateKey: string) => {
    setDayLogsLoading(true);
    setDayLogs([]);
    try {
      const res = await apiFetch<{ data: Log[] }>(
        `/logs/by-date?date=${dateKey}&timezoneOffsetMinutes=${tzOffsetMinutes}`
      );
      setDayLogs(res.data ?? []);
    } catch {
      setDayLogs([]);
    } finally {
      setDayLogsLoading(false);
    }
  }, [tzOffsetMinutes]);

  useEffect(() => {
    if (selectedDate && isPro) fetchDayLogs(selectedDate);
    else setDayLogs([]);
  }, [selectedDate, isPro, fetchDayLogs]);

  const prevMonth = useCallback(() => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  }, [month]);

  const nextMonth = useCallback(() => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  }, [month]);

  const handleDayClick = useCallback(
    (dateKey: string) => {
      if (!isPro) return;
      setSelectedDate(dateKey);
    },
    [isPro]
  );

  const now = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startWeekday = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const leadingBlanks = (startWeekday + 6) % 7;

  const monthName = new Date(year, month - 1, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });

  /** Show skeleton until the viewed month matches loaded data (handles me/isPro hydration and month changes). */
  const calendarBusy =
    isPro &&
    (loading || data == null || data.year !== year || data.month !== month);

  return (
    <>
      <Card
        className={`relative min-w-0 w-full max-w-full border border-[var(--color-mid)]/30 bg-[var(--color-dark)] overflow-hidden ${!isPro ? "select-none" : ""}`}
        style={paperShadow}
      >
        {!isPro && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[var(--color-dark)]/80 backdrop-blur-md"
            aria-hidden
          >
            <p className="text-center text-sm font-medium text-[var(--color-lightest)] px-4">
              {t("dashboard.calendarProOnly")}
            </p>
            <Button asChild size="sm" className="btn-gradient">
              <Link to="/tiers">{t("tiers.upgradeToPro")}</Link>
            </Button>
          </div>
        )}
        <div className={!isPro ? "pointer-events-none blur-sm" : ""}>
          <div className="flex min-w-0 items-center justify-between gap-2 border-b border-[var(--color-mid)]/30 px-4 py-3">
            <h3 className="shrink-0 text-sm font-semibold uppercase tracking-wide text-[var(--color-light)]">
              {t("dashboard.calendarTitle")}
            </h3>
            {isPro && (
              <div className="flex min-w-0 shrink items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-[var(--color-light)] hover:bg-[var(--color-mid)]/20 hover:text-[var(--color-lightest)]"
                  onClick={prevMonth}
                  aria-label={t("dashboard.calendarPrevMonth")}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-0 shrink text-center text-sm font-medium text-[var(--color-lightest)] truncate px-2">
                  {monthName}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-[var(--color-light)] hover:bg-[var(--color-mid)]/20 hover:text-[var(--color-lightest)]"
                  onClick={nextMonth}
                  aria-label={t("dashboard.calendarNextMonth")}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          <div className="relative min-h-[16rem]">
            <div className="grid grid-cols-7 text-center [&>*:nth-child(7n)]:border-r-0">
              {WEEKDAY_KEYS.map((key) => (
                <div
                  key={key}
                  className="border-b border-r border-[var(--color-mid)]/20 py-2 text-xs font-medium text-[var(--color-mid)]"
                >
                  {t(key)}
                </div>
              ))}
              {Array.from({ length: leadingBlanks }, (_, i) => (
                <div
                  key={`blank-${i}`}
                  className="min-h-[3.5rem] border-b border-r border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/30 last:border-r-0"
                />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const key = getMonthKey(year, month, day);
                const count = data?.dates[key] ?? 0;
                const isToday = isCurrentMonth && now.getDate() === day;
                const DayCell = isPro ? "button" : "div";
                return (
                  <DayCell
                    key={day}
                    type={isPro ? "button" : undefined}
                    onClick={isPro ? () => handleDayClick(key) : undefined}
                    className={`relative min-h-[3.5rem] flex flex-col items-center justify-start gap-0.5 border-b border-r border-[var(--color-mid)]/20 bg-[var(--color-dark)] pt-1.5 text-left ${
                      isPro
                        ? "cursor-pointer hover:bg-[var(--color-mid)]/15 active:bg-[var(--color-mid)]/25"
                        : ""
                    } ${isToday ? "ring-1 ring-inset ring-[var(--color-mid)] bg-[var(--color-mid)]/10" : ""}`}
                    title={count > 0 ? t("dashboard.calendarCompletions", { count: String(count), date: key }) : undefined}
                    aria-label={count > 0 ? t("dashboard.calendarCompletions", { count: String(count), date: key }) : `${day}`}
                  >
                    <span
                      className={`text-xs font-medium ${isToday ? "text-[var(--color-lightest)]" : count > 0 ? "text-[var(--color-lightest)]" : "text-[var(--color-mid)]"}`}
                    >
                      {day}
                    </span>
                    {isPro && count > 0 && (
                      <span className="flex gap-0.5 flex-wrap justify-center px-0.5">
                        {Array.from({ length: Math.min(count, 4) }, (_, j) => (
                          <span
                            key={j}
                            className="h-1.5 w-1.5 rounded-full bg-[var(--btn-gradient-start)]"
                            aria-hidden
                          />
                        ))}
                        {count > 4 && (
                          <span className="text-[9px] text-[var(--color-light)] leading-none">+{count - 4}</span>
                        )}
                      </span>
                    )}
                  </DayCell>
                );
              })}
            </div>
            {calendarBusy && (
              <div
                className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-3 bg-[var(--color-dark)]/82 p-3 backdrop-blur-[1px]"
                aria-busy
                aria-label={t("common.loading")}
              >
                <div className="grid w-full max-w-full grid-cols-7 gap-1 sm:gap-1.5">
                  {Array.from({ length: 35 }).map((_, idx) => (
                    <Skeleton
                      key={idx}
                      className="aspect-square min-h-[2.5rem] rounded-sm bg-[var(--color-mid)]/35"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {isPro && selectedDate && (
        isMobile ? (
          <Drawer open onOpenChange={(open) => !open && setSelectedDate(null)}>
            <DrawerContent
              mobileHeight="95%"
              className="flex flex-col p-4 sm:p-6"
              onClose={() => setSelectedDate(null)}
              onReady={(requestClose, requestCloseImmediately) => {
                drawerCloseRef.current = requestClose;
                drawerCloseImmediatelyRef.current = requestCloseImmediately ?? null;
              }}
            >
              <div className="mt-6">
                <h2 className="mb-4 min-w-0 truncate text-lg font-semibold text-[var(--color-lightest)]">
                  {t("dashboard.calendarActivityOn", { date: formatCalendarDayDate(selectedDate, locale) })}
                </h2>
                {dayLogsLoading ? (
                  <div className="py-8 flex justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-mid)] border-t-[var(--color-lightest)]" />
                  </div>
                ) : dayLogs.length === 0 ? (
                  <p className="py-6 text-center text-sm text-[var(--color-light)]">
                    {t("dashboard.calendarNoActivity")}
                  </p>
                ) : (
                  <ul className="list-none m-0 p-0 flex flex-col gap-2">
                    {dayLogs.map((log) => (
                      <li key={log.id}>
                        <Link
                          to={`/item/${log.mediaType}/${log.externalId}`}
                          className="flex gap-3 rounded-lg border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/50 p-3 text-inherit no-underline hover:bg-[var(--color-mid)]/15"
                          onClick={() => setSelectedDate(null)}
                        >
                        <ItemImage src={log.image} className="h-14 w-10 shrink-0 rounded object-cover" />
                        <div className="min-w-0 flex-1 flex flex-col gap-0.5 justify-center">
                          <p className="truncate font-medium text-[var(--color-lightest)] text-sm">
                            {log.title}
                          </p>
                          <p className="text-xs text-[var(--color-light)]">
                            {t(`nav.${log.mediaType}`)}
                            {(() => {
                              const duration = log.startedAt && log.completedAt ? formatTimeToFinish(log.startedAt, log.completedAt) : "";
                              return duration ? <> · {t("dashboard.finishedIn", { duration })}</> : null;
                            })()}
                          </p>
                          {log.status != null && (IN_PROGRESS_STATUSES as readonly string[]).includes(log.status) ? (
                            <span className="rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-medium text-white">
                              {t("common.inProgress")}
                            </span>
                          ) : log.grade != null ? (
                            <StarRating value={gradeToStars(log.grade)} readOnly size="sm" />
                          ) : null}
                        </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <DrawerFooter>
                <Button type="button" variant="outline" className="w-full max-md:min-h-[48px]" onClick={() => setSelectedDate(null)}>
                  {t("common.close")}
                </Button>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        ) : (
          <Dialog open onOpenChange={(open) => !open && setSelectedDate(null)}>
            <DialogContent
              className="max-h-[85vh] flex flex-col max-w-md"
              onClose={() => setSelectedDate(null)}
            >
              <DialogHeader>
                <DialogTitle className="text-[var(--color-lightest)]">
                  {t("dashboard.calendarActivityOn", { date: formatCalendarDayDate(selectedDate, locale) })}
                </DialogTitle>
              </DialogHeader>
              <div className="min-h-0 overflow-y-auto -mx-1 px-1">
                {dayLogsLoading ? (
                  <div className="py-8 flex justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-mid)] border-t-[var(--color-lightest)]" />
                  </div>
                ) : dayLogs.length === 0 ? (
                  <p className="py-6 text-center text-sm text-[var(--color-light)]">
                    {t("dashboard.calendarNoActivity")}
                  </p>
                ) : (
                  <ul className="list-none m-0 p-0 flex flex-col gap-2">
                    {dayLogs.map((log) => (
                      <li key={log.id}>
                        <Link
                          to={`/item/${log.mediaType}/${log.externalId}`}
                          className="flex gap-3 rounded-lg border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/50 p-3 text-inherit no-underline hover:bg-[var(--color-mid)]/15"
                          onClick={() => setSelectedDate(null)}
                        >
                          <ItemImage src={log.image} className="h-14 w-10 shrink-0 rounded object-cover" />
                          <div className="min-w-0 flex-1 flex flex-col gap-0.5 justify-center">
                            <p className="truncate font-medium text-[var(--color-lightest)] text-sm">
                              {log.title}
                            </p>
                            <p className="text-xs text-[var(--color-light)]">
                              {t(`nav.${log.mediaType}`)}
                              {(() => {
                                const duration = log.startedAt && log.completedAt ? formatTimeToFinish(log.startedAt, log.completedAt) : "";
                                return duration ? <> · {t("dashboard.finishedIn", { duration })}</> : null;
                              })()}
                            </p>
                            {log.status != null && (IN_PROGRESS_STATUSES as readonly string[]).includes(log.status) ? (
                              <span className="rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-medium text-white">
                                {t("common.inProgress")}
                              </span>
                            ) : log.grade != null ? (
                              <StarRating value={gradeToStars(log.grade)} readOnly size="sm" />
                            ) : null}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )
      )}
    </>
  );
}
