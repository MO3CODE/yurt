import { Flame, Trophy, BookOpenCheck, Medal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { addDaysISO, dayOfWeekISO } from "@/lib/date";
import { arNum, daysLabel } from "@/lib/quran";
import { dayComplete, streaks, type DayTotal } from "@/lib/quran/stats";

const WEEKDAYS = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

/** السلسلة والإحصائيات: بطاقات أرقام، أعمدة آخر ٧ أيام، وتقويم الشهر الحالي */
export function WirdStats({
  totals,
  today,
  goal,
  khatmas,
}: {
  totals: Map<string, DayTotal>;
  today: string;
  goal: number | null;
  khatmas: number;
}) {
  const { current, best, todayDone } = streaks(totals, today, goal);
  const monthPrefix = today.slice(0, 7);
  const monthPages = [...totals.entries()].filter(([d]) => d.startsWith(monthPrefix)).reduce((s, [, t]) => s + t.pages, 0);

  const week = Array.from({ length: 7 }, (_, i) => {
    const date = addDaysISO(today, i - 6);
    return { date, total: totals.get(date) };
  });
  const scale = Math.max(goal ?? 0, ...week.map((w) => w.total?.pages ?? 0), 1);

  // تقويم الشهر: يبدأ الأسبوع بالأحد مثل جدول النظافة
  const monthStart = `${monthPrefix}-01`;
  const daysInMonth = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)).getUTCDate();
  const lead = dayOfWeekISO(monthStart);

  const tiles = [
    {
      icon: Flame,
      label: "السلسلة الحالية",
      value: current > 0 ? daysLabel(current) : "ابدأها اليوم",
      hint: current > 0 && !todayDone ? "أكمل ورد اليوم لتستمر" : null,
      tone: "text-orange-500",
    },
    { icon: Trophy, label: "أطول سلسلة", value: best > 0 ? daysLabel(best) : "—", hint: null, tone: "text-gold" },
    { icon: BookOpenCheck, label: "صفحات هذا الشهر", value: arNum(Math.round(monthPages)), hint: null, tone: "text-primary" },
    { icon: Medal, label: "الختمات", value: arNum(khatmas), hint: null, tone: "text-success" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>إحصائياتي</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="flex flex-col gap-1 rounded-xl bg-muted/50 p-3">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <t.icon className={cn("size-4", t.tone)} /> {t.label}
              </span>
              <span className="text-lg font-semibold">{t.value}</span>
              {t.hint && <span className="text-[11px] text-muted-foreground">{t.hint}</span>}
            </div>
          ))}
        </div>

        <section className="flex flex-col gap-2">
          <span className="text-sm font-medium">آخر ٧ أيام</span>
          <div className="relative flex h-32 items-end gap-2" role="img" aria-label="صفحات الورد في آخر سبعة أيام">
            {goal && (
              <div
                className="pointer-events-none absolute inset-x-0 border-t border-dashed border-gold/70"
                style={{ bottom: `${(goal / scale) * 100}%` }}
                aria-hidden
              >
                <span className="absolute -top-4 start-0 text-[10px] text-gold">الهدف {arNum(goal)}</span>
              </div>
            )}
            {week.map(({ date, total }) => {
              const pages = total?.pages ?? 0;
              const done = dayComplete(total, goal);
              return (
                <div key={date} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-[10px] tabular-nums text-muted-foreground">{pages > 0 ? arNum(Math.round(pages)) : ""}</span>
                  <div
                    className={cn("w-full max-w-10 rounded-t-md transition-all", done ? "bg-primary" : pages > 0 ? "bg-primary/35" : "bg-muted")}
                    style={{ height: `${Math.max(4, (pages / scale) * 100)}%` }}
                  />
                  <span className={cn("text-[10px]", date === today ? "font-semibold text-foreground" : "text-muted-foreground")}>
                    {date === today ? "اليوم" : WEEKDAYS[dayOfWeekISO(date)]}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <span className="text-sm font-medium">هذا الشهر</span>
          <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] text-muted-foreground">
            {WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
            {Array.from({ length: lead }, (_, i) => (
              <span key={`lead${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const date = addDaysISO(monthStart, i);
              const total = totals.get(date);
              const done = dayComplete(total, goal);
              const future = date > today;
              return (
                <span
                  key={date}
                  title={total ? `${arNum(Math.round(total.pages))} صفحة` : undefined}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-md text-xs tabular-nums",
                    done ? "bg-primary text-primary-foreground" : total ? "bg-primary/25 text-foreground" : future ? "text-muted-foreground/50" : "bg-muted/60",
                    date === today && "ring-2 ring-gold ring-offset-1 ring-offset-card"
                  )}
                >
                  {arNum(i + 1)}
                </span>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-sm bg-primary" /> أتممت الورد
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-sm bg-primary/25" /> قرأت جزءاً منه
            </span>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
