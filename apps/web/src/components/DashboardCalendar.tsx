import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { decodeLogForDisplay } from "@/lib/decodeDisplayFields";
import { useLocale } from "@/contexts/LocaleContext";
import { Skeleton } from "@/components/ui/skeleton";
import { LogActivitySheet } from "@/components/LogActivitySheet";
import { ItemImage } from "@/components/ItemImage";
import { type Log, type MediaType } from "@geeklogs/shared";
import { paperShadow } from "@/lib/paperShadow";
import { OverflowMarquee } from "@/components/OverflowMarquee";
import { cn } from "@/lib/utils";

const WEEKDAY_KEYS = [
  "dashboard.calendarMon",
  "dashboard.calendarTue",
  "dashboard.calendarWed",
  "dashboard.calendarThu",
  "dashboard.calendarFri",
  "dashboard.calendarSat",
  "dashboard.calendarSun",
] as const;

interface CalendarDayItem {
  image: string | null;
  title: string;
  externalId: string;
  mediaType: string;
  boardGameSource?: string | null;
}

interface CalendarData {
  year: number;
  month: number;
  dates: Record<string, number>;
  items?: Record<string, CalendarDayItem | null>;
}

function getMonthKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatCalendarDayDate(dateKey: string, locale: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

/** Same calendar month anchor as GET /logs/stats (timezoneOffsetMinutes). */
function calendarMonthFromOffset(tzOffsetMinutes: number): { year: number; month: number } {
  const offsetMs = tzOffsetMinutes * 60 * 1000;
  const shifted = new Date(Date.now() + offsetMs);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1 };
}

export type DashboardCalendarAccess = "full" | "monthOnly";

export function DashboardCalendar({
  access,
  fillColumnHeight,
  mediaType,
}: {
  /** full = any month (Pro). monthOnly = current calendar month in user TZ (free statistics). */
  access: DashboardCalendarAccess;
  /** When set (e.g. Statistics desktop two-column row), the card stretches to match the sibling column height. */
  fillColumnHeight?: boolean;
  /** When set, only count activity for this category. */
  mediaType?: MediaType;
}) {
  const { t, locale } = useLocale();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayLogs, setDayLogs] = useState<Log[]>([]);
  const [dayLogsLoading, setDayLogsLoading] = useState(false);

  const tzOffsetMinutes = useMemo(() => -new Date().getTimezoneOffset(), []);

  const canFetchCalendar = access === "full" || access === "monthOnly";
  const canInteract = canFetchCalendar;

  useEffect(() => {
    if (access !== "monthOnly") return;
    const { year: y, month: m } = calendarMonthFromOffset(tzOffsetMinutes);
    setYear(y);
    setMonth(m);
  }, [access, tzOffsetMinutes]);

  const fetchCalendar = useCallback(async (y: number, m: number) => {
    if (!canFetchCalendar) return;
    setLoading(true);
    try {
      const mediaQ = mediaType ? `&mediaType=${encodeURIComponent(mediaType)}` : "";
      const res = await apiFetch<CalendarData>(
        `/logs/calendar?year=${y}&month=${m}&timezoneOffsetMinutes=${tzOffsetMinutes}${mediaQ}`
      );
      setData(res);
    } catch {
      setData({ year: y, month: m, dates: {} });
    } finally {
      setLoading(false);
    }
  }, [canFetchCalendar, tzOffsetMinutes, mediaType]);

  useEffect(() => {
    if (!canFetchCalendar) {
      setData(null);
      setLoading(false);
      return;
    }
    void fetchCalendar(year, month);
  }, [canFetchCalendar, year, month, fetchCalendar]);

  const fetchDayLogs = useCallback(async (dateKey: string) => {
    setDayLogsLoading(true);
    setDayLogs([]);
    try {
      const mediaQ = mediaType ? `&mediaType=${encodeURIComponent(mediaType)}` : "";
      const res = await apiFetch<{ data: Log[] }>(
        `/logs/by-date?date=${dateKey}&timezoneOffsetMinutes=${tzOffsetMinutes}${mediaQ}`
      );
      setDayLogs((res.data ?? []).map(decodeLogForDisplay));
    } catch {
      setDayLogs([]);
    } finally {
      setDayLogsLoading(false);
    }
  }, [tzOffsetMinutes, mediaType]);

  useEffect(() => {
    if (selectedDate && canInteract) fetchDayLogs(selectedDate);
    else setDayLogs([]);
  }, [selectedDate, canInteract, fetchDayLogs]);

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
      if (!canInteract) return;
      setSelectedDate(dateKey);
    },
    [canInteract]
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

  /** Show skeleton until the viewed month matches loaded data (handles access hydration and month changes). */
  const calendarBusy =
    canFetchCalendar &&
    (loading || data == null || data.year !== year || data.month !== month);

  return (
    <>
      <Card
        className={cn(
          "relative min-w-0 w-full max-w-full border border-[var(--color-mid)]/30 bg-[var(--color-dark)] overflow-hidden",
          fillColumnHeight && "md:flex md:h-full md:min-h-0 md:flex-col"
        )}
        style={paperShadow}
      >
        <div className={cn(fillColumnHeight && "flex min-h-0 min-w-0 flex-1 flex-col")}>
          <div className="flex min-w-0 shrink-0 items-center justify-between gap-2 border-b border-[var(--color-mid)]/30 px-4 py-3">
            <h3 className="min-w-0 flex-1 text-sm font-semibold uppercase tracking-wide text-[var(--color-light)]">
              <OverflowMarquee>{t("dashboard.calendarTitle")}</OverflowMarquee>
            </h3>
            {access === "full" && (
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
                <OverflowMarquee className="min-w-0 shrink px-2 text-center text-sm font-medium text-[var(--color-lightest)]">
                  {monthName}
                </OverflowMarquee>
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
            {access === "monthOnly" && (
              <span className="shrink-0 text-xs text-[var(--color-light)]">{t("statistics.purchasePeriodMonth")}</span>
            )}
          </div>
          <div
            className={cn(
              "relative min-h-[16rem]",
              fillColumnHeight && "min-h-0 flex-1"
            )}
          >
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
                const item = data?.items?.[key] ?? null;
                const isToday = isCurrentMonth && now.getDate() === day;
                const DayCell = canInteract ? "button" : "div";
                return (
                  <DayCell
                    key={day}
                    type={canInteract ? "button" : undefined}
                    onClick={canInteract ? () => handleDayClick(key) : undefined}
                    className={`relative min-h-[3.5rem] flex flex-col items-center justify-start gap-0.5 border-b border-r border-[var(--color-mid)]/20 bg-[var(--color-dark)] pt-1.5 text-left ${
                      canInteract
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
                    {canInteract && count > 0 && (
                      item?.image ? (
                        <div className="relative mt-0.5 flex h-9 w-full min-w-0 max-w-full items-center justify-center overflow-hidden rounded-md border border-[var(--color-mid)]/30 bg-[var(--color-darkest)] py-0.5">
                          <ItemImage
                            src={item.image}
                            alt={item.title}
                            imgClassName="object-contain max-h-full max-w-[90%]"
                            className="h-full w-full"
                            loading="lazy"
                          />
                          {count > 1 && (
                            <span className="absolute bottom-0 right-0 rounded-tl-md bg-black/70 px-1 text-[9px] font-semibold leading-tight text-white">
                              +{count - 1}
                            </span>
                          )}
                        </div>
                      ) : (
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
                      )
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

      <LogActivitySheet
        open={canInteract && selectedDate != null}
        onClose={() => setSelectedDate(null)}
        title={
          selectedDate
            ? t("dashboard.calendarActivityOn", { date: formatCalendarDayDate(selectedDate, locale) })
            : ""
        }
        logs={dayLogs}
        loading={dayLogsLoading}
      />
    </>
  );
}
