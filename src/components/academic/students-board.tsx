"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, ChevronLeft, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { GPA_TONE_CLASSES, formatGpa, gpaRatio, type GpaTone } from "@/lib/academic";
import { cn } from "@/lib/utils";

export type BoardStudent = {
  id: string;
  name: string;
  meta: string;
  tracked: boolean;
  gpa: number | null;
  scale: number;
  tone: GpaTone;
  /** أيام حتى الجلسة القادمة؛ سالب = متأخرة، null = لا موعد */
  daysToSession: number | null;
  nextSessionLabel: string | null;
  strong: string[];
  struggling: string[];
};

type Filter = "all" | "risk" | "session" | "untracked";

function sessionBadge(days: number | null, label: string | null) {
  if (days === null || !label) return null;
  if (days < 0) return { text: `متأخرة ${-days} يوم`, className: "bg-destructive/10 text-destructive" };
  if (days === 0) return { text: "الجلسة اليوم", className: "bg-warning/18 text-warning-foreground dark:text-warning" };
  if (days <= 7) return { text: `بعد ${days} يوم`, className: "bg-warning/18 text-warning-foreground dark:text-warning" };
  return { text: label, className: "bg-muted text-muted-foreground" };
}

export function StudentsBoard({ students }: { students: BoardStudent[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(
    () => ({
      all: students.length,
      risk: students.filter((s) => s.tone === "risk" || s.struggling.length >= 3).length,
      session: students.filter((s) => s.daysToSession !== null && s.daysToSession <= 7).length,
      untracked: students.filter((s) => !s.tracked).length,
    }),
    [students]
  );

  const visible = useMemo(() => {
    const q = query.trim();
    return students.filter((s) => {
      if (q && !s.name.includes(q) && !s.struggling.some((x) => x.includes(q)) && !s.strong.some((x) => x.includes(q))) return false;
      if (filter === "risk") return s.tone === "risk" || s.struggling.length >= 3;
      if (filter === "session") return s.daysToSession !== null && s.daysToSession <= 7;
      if (filter === "untracked") return !s.tracked;
      return true;
    });
  }, [students, query, filter]);

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "الكل" },
    { key: "risk", label: "يحتاجون اهتماماً" },
    { key: "session", label: "جلسة قريبة أو متأخرة" },
    { key: "untracked", label: "بلا بيانات" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث باسم طالب أو مادة…"
            className="h-9 ps-9"
            aria-label="بحث"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filter === f.key ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/40 hover:text-primary"
              )}
            >
              {f.label}
              <span className={cn("tabular-nums", filter === f.key ? "opacity-80" : "text-muted-foreground")}>{counts[f.key]}</span>
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <Search />
          </EmptyMedia>
          <EmptyTitle>لا توجد نتائج</EmptyTitle>
          <EmptyDescription>غيّر البحث أو الفلتر</EmptyDescription>
        </Empty>
      ) : (
        <ul className="stagger flex flex-col gap-2">
          {visible.map((s) => {
            const tone = GPA_TONE_CLASSES[s.tone];
            const ratio = gpaRatio(s.gpa, s.scale);
            const badge = sessionBadge(s.daysToSession, s.nextSessionLabel);
            return (
              <li key={s.id} className="@container">
                <Link
                  href={`/admin/academic/${s.id}`}
                  className="card-interactive group flex flex-col gap-3 rounded-2xl border bg-card p-3.5 outline-none focus-visible:ring-2 focus-visible:ring-ring @2xl:flex-row @2xl:items-center @2xl:gap-4"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {s.name.split(" ").slice(0, 2).map((p) => p[0]).join("")}
                    </span>
                    <div className="flex min-w-0 flex-col leading-tight">
                      <span className="truncate font-semibold group-hover:text-primary">{s.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{s.meta || "—"}</span>
                    </div>
                  </div>

                  {/* المعدل */}
                  <div className="flex w-full flex-col gap-1 @2xl:w-36">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className={cn("font-semibold tabular-nums", tone.text)} dir="ltr">
                        {s.tracked ? formatGpa(s.gpa, s.scale) : "—"}
                      </span>
                      <span className="text-muted-foreground">{s.tracked ? tone.label : "لم تُدخل بياناته"}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className={cn("h-full rounded-full", tone.bar)} style={{ width: `${Math.round((ratio ?? 0) * 100)}%` }} />
                    </div>
                  </div>

                  {/* المواد */}
                  <div className="flex min-w-0 flex-wrap items-center gap-1 @2xl:w-64">
                    {s.struggling.slice(0, 3).map((n) => (
                      <span key={`s-${n}`} className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                        {n}
                      </span>
                    ))}
                    {s.struggling.length > 3 && <span className="text-xs text-muted-foreground">+{s.struggling.length - 3}</span>}
                    {s.strong.slice(0, 2).map((n) => (
                      <span key={`g-${n}`} className="rounded-full bg-success/12 px-2 py-0.5 text-xs text-success">
                        {n}
                      </span>
                    ))}
                    {s.strong.length > 2 && <span className="text-xs text-muted-foreground">+{s.strong.length - 2}</span>}
                    {s.struggling.length + s.strong.length === 0 && <span className="text-xs text-muted-foreground">لا مواد مسجّلة</span>}
                  </div>

                  {/* الجلسة */}
                  <div className="flex items-center justify-between gap-2 @2xl:w-32 @2xl:justify-end">
                    {badge ? (
                      <span className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium", badge.className)}>
                        <CalendarClock className="size-3" />
                        {badge.text}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">لا موعد</span>
                    )}
                    <ChevronLeft className="size-4 text-muted-foreground transition-transform group-hover:-translate-x-0.5 @2xl:hidden" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
