"use client";

import { useOptimistic, useTransition } from "react";
import { CircleCheck, Clock3, FileText, CircleX, ShieldCheck, type LucideIcon } from "lucide-react";
import { logAttendance } from "@/app/app/attendance/actions";
import type { AttendanceStatus } from "@/lib/supabase/types";
import { toast } from "sonner";
import { unwrap } from "@/lib/unwrap";
import { cn } from "@/lib/utils";

const OPTIONS: { value: AttendanceStatus; label: string; icon: LucideIcon; active: string }[] = [
  { value: "present", label: "حاضر", icon: CircleCheck, active: "border-success/40 bg-success/10 text-success" },
  { value: "late", label: "متأخر", icon: Clock3, active: "border-warning/50 bg-warning/12 text-warning-foreground dark:text-warning" },
  { value: "excused", label: "بعذر", icon: FileText, active: "border-primary/40 bg-primary/10 text-primary" },
  { value: "absent", label: "غائب", icon: CircleX, active: "border-destructive/40 bg-destructive/10 text-destructive" },
];

export function AttendanceToday({
  date,
  status,
  locked = false,
}: {
  date: string;
  status?: AttendanceStatus;
  /** سجّله أو اعتمده المشرف/الإدارة — للعرض فقط */
  locked?: boolean;
}) {
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(status);

  function choose(value: AttendanceStatus) {
    if (locked || value === optimistic) return;
    startTransition(async () => {
      setOptimistic(value);
      try {
        await unwrap(logAttendance(date, value));
        toast.success("تم تسجيل حضورك");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر تسجيل الحضور");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div role="radiogroup" aria-label="حضورك اليوم" aria-disabled={locked} className="grid grid-cols-4 gap-2">
        {OPTIONS.map((o) => {
          const selected = optimistic === o.value;
          const Icon = o.icon;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={locked && !selected}
              onClick={() => choose(o.value)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border px-1 py-3 text-xs font-medium transition-all duration-200 active:scale-95",
                selected
                  ? cn(o.active, "animate-pop")
                  : "border-border bg-card text-muted-foreground hover:border-primary/25 hover:text-foreground",
                locked && !selected && "opacity-40 hover:border-border hover:text-muted-foreground"
              )}
            >
              <Icon className="size-5" />
              {o.label}
            </button>
          );
        })}
      </div>
      {locked && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-primary" /> اعتمد المشرف حضورك لهذا اليوم
        </p>
      )}
    </div>
  );
}
