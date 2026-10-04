import Link from "next/link";
import { ArrowUpLeft, CalendarClock, ListChecks, NotebookPen } from "lucide-react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/progress-ring";
import { TRACK_LABELS } from "@/lib/academic";
import { daysBetweenISO, formatShortDateISO } from "@/lib/date";
import type { PlanStatus, PlanTrack } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type PlanRow = { id: string; title: string; track: PlanTrack; status: PlanStatus; due_date: string | null };

/** ملخص «خطتي» والجلسات القريبة في لوحة الإدارة الرئيسية (لمن يملك صلاحية المتابعة الأكاديمية) */
export function AcademicSnapshot({
  plan,
  sessionsDue,
  sessionsOverdue,
  today,
}: {
  plan: PlanRow[];
  sessionsDue: number;
  sessionsOverdue: number;
  today: string;
}) {
  const total = plan.length;
  const done = plan.filter((p) => p.status === "done").length;
  const remaining = plan.filter((p) => p.status !== "done");
  const overdue = remaining.filter((p) => p.due_date && daysBetweenISO(today, p.due_date) < 0).length;
  const upcoming = remaining
    .filter((p) => p.due_date)
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!))
    .slice(0, 3);
  const next = upcoming.length > 0 ? upcoming : remaining.slice(0, 3);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <NotebookPen className="size-4 text-primary" /> خطتي والمتابعة الأكاديمية
        </CardTitle>
        <CardDescription>ما أُنجز وما بقي، والجلسات القريبة</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/admin/academic/plan" />}>
            التفاصيل <ArrowUpLeft />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="@container">
        <div className="grid gap-5 @xl:grid-cols-2">
        {total === 0 ? (
          <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            <ListChecks className="size-5 text-primary" />
            لم ترفع خطتك بعد — ارفعها لتتابع ما تم وما لم يتم من هنا.
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/admin/academic/plan" />}>
              رفع الخطة
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <ProgressRing value={done} max={total} size={84} stroke={8}>
              <span className="font-heading text-lg font-semibold tabular-nums">{Math.round((done / total) * 100)}%</span>
            </ProgressRing>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-sm">
                <span className="font-heading text-xl font-semibold tabular-nums">{done}</span>
                <span className="text-muted-foreground"> من {total} بنداً منجزاً</span>
              </span>
              {overdue > 0 && <span className="w-fit rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">{overdue} بند متأخر</span>}
              <ul className="flex flex-col gap-1 text-xs">
                {next.map((p) => {
                  const days = p.due_date ? daysBetweenISO(today, p.due_date) : null;
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        <span className="text-muted-foreground">{TRACK_LABELS[p.track]} · </span>
                        {p.title}
                      </span>
                      {days !== null && (
                        <span className={cn("shrink-0", days < 0 ? "text-destructive" : "text-muted-foreground")}>
                          {days < 0 ? `متأخر ${-days} ي` : formatShortDateISO(p.due_date!)}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        <Link
          href="/admin/academic"
          className="card-interactive flex items-center gap-3 rounded-xl border p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", sessionsOverdue > 0 ? "bg-destructive/10 text-destructive" : "bg-warning/18 text-warning-foreground dark:text-warning")}>
            <CalendarClock className="size-5" />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="font-heading text-xl font-semibold tabular-nums">{sessionsDue}</span>
            <span className="text-sm text-muted-foreground">جلسة تقييم خلال ٧ أيام أو متأخرة</span>
            {sessionsOverdue > 0 && <span className="text-xs font-medium text-destructive">منها {sessionsOverdue} متأخرة</span>}
          </div>
        </Link>
        </div>
      </CardContent>
    </Card>
  );
}
