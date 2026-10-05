import Link from "next/link";
import { CheckCircle2, GraduationCap, PlayCircle } from "lucide-react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScheduleBadge } from "@/components/learning/schedule-badge";
import { unitsLabel } from "@/lib/learning";
import type { MyCourse } from "@/lib/learning/server";

/** دروس اليوم من الكورسات المنضم إليها (تظهر في «مهامي» والرئيسية) */
export function LearningToday({ courses, compact = false }: { courses: MyCourse[]; compact?: boolean }) {
  const active = courses.filter((c) => c.schedule.state !== "completed");
  if (active.length === 0) return null;
  const pending = active.filter((c) => c.todayUnits.length > 0);
  const total = pending.reduce((s, c) => s + c.todayUnits.length, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="size-5 text-primary" /> دروس اليوم
        </CardTitle>
        <CardDescription>{total > 0 ? `${unitsLabel(total)} من كورساتك` : "أنجزت دروس اليوم كلها ✓"}</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/app/learn" />}>
            كورساتي
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {active.map((c) => (
          <div key={c.id} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Link href={`/app/learn/${c.id}`} className="min-w-0 truncate text-sm font-medium hover:underline">
                {c.title}
              </Link>
              <ScheduleBadge state={c.schedule.state} behind={c.schedule.behind} className="shrink-0" />
            </div>
            {c.todayUnits.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {c.todayUnits.slice(0, compact ? 2 : 6).map((u) => (
                  <li key={u.id}>
                    <Link
                      href={`/app/learn/${c.id}/${u.id}`}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted/60"
                    >
                      <PlayCircle className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 truncate">{u.title}</span>
                    </Link>
                  </li>
                ))}
                {compact && c.todayUnits.length > 2 && (
                  <li className="px-2 text-xs text-muted-foreground">
                    {c.todayUnits.length === 3 ? "ودرس آخر" : `و${unitsLabel(c.todayUnits.length - 2)} أخرى`}
                  </li>
                )}
              </ul>
            ) : (
              <span className="flex items-center gap-1.5 px-2 text-xs text-success">
                <CheckCircle2 className="size-3.5" /> لا شيء مطلوب اليوم
              </span>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
