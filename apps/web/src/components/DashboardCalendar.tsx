import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useLocale } from "@/contexts/LocaleContext";

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

export function DashboardCalendar({ isPro }: { isPro: boolean }) {
  const { t } = useLocale();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchCalendar = useCallback(async (y: number, m: number) => {
    if (!isPro) return;
    setLoading(true);
    try {
      const res = await apiFetch<CalendarData>(`/logs/calendar?year=${y}&month=${m}`);
      setData(res);
    } catch {
      setData({ year: y, month: m, dates: {} });
    } finally {
      setLoading(false);
    }
  }, [isPro]);

  useEffect(() => {
    if (isPro) fetchCalendar(year, month);
    else setData(null);
  }, [isPro, year, month, fetchCalendar]);

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

  const now = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startWeekday = firstDay.getDay(); // 0 = Sun, 1 = Mon, ...
  const daysInMonth = lastDay.getDate();
  const leadingBlanks = (startWeekday + 6) % 7;

  const monthName = new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <Card
      className={`relative min-w-0 border-[var(--color-dark)] bg-[var(--color-dark)] p-4 overflow-hidden md:max-w-[20rem] ${!isPro ? "select-none" : ""}`}
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
        <div className="flex min-w-0 items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold uppercase text-[var(--color-light)]">
            {t("dashboard.calendarTitle")}
          </h3>
          {isPro && (
            <div className="flex items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-[var(--color-light)] hover:text-[var(--color-lightest)]"
                onClick={prevMonth}
                aria-label={t("dashboard.calendarPrevMonth")}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[10rem] text-center text-sm font-medium text-[var(--color-lightest)]">
                {monthName}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-[var(--color-light)] hover:text-[var(--color-lightest)]"
                onClick={nextMonth}
                aria-label={t("dashboard.calendarNextMonth")}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {WEEKDAY_KEYS.map((key) => (
            <div key={key} className="py-1 text-xs font-medium text-[var(--color-mid)]">
              {t(key)}
            </div>
          ))}
          {Array.from({ length: leadingBlanks }, (_, i) => (
            <div key={`blank-${i}`} className="aspect-square" />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const key = getMonthKey(year, month, day);
            const count = data?.dates[key] ?? 0;
            const isToday = isCurrentMonth && now.getDate() === day;
            return (
              <div
                key={day}
                className={`flex aspect-square flex-col items-center justify-center rounded text-xs ${
                  isToday ? "ring-1 ring-[var(--color-mid)] bg-[var(--color-mid)]/20" : ""
                } ${count > 0 ? "text-[var(--color-lightest)]" : "text-[var(--color-mid)]"}`}
                title={count > 0 ? t("dashboard.calendarCompletions", { count: String(count), date: key }) : undefined}
              >
                <span>{day}</span>
                {isPro && count > 0 && (
                  <span className="mt-0.5 flex gap-0.5">
                    {Array.from({ length: Math.min(count, 3) }, (_, j) => (
                      <span
                        key={j}
                        className="h-1 w-1 rounded-full bg-[var(--btn-gradient-start)]"
                        aria-hidden
                      />
                    ))}
                    {count > 3 && (
                      <span className="text-[10px] text-[var(--color-light)]">+{count - 3}</span>
                    )}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {isPro && loading && (
          <div className="mt-2 h-6 animate-pulse rounded bg-[var(--color-darkest)]" aria-hidden />
        )}
      </div>
    </Card>
  );
}
