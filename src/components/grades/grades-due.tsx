import Link from "next/link";
import { FileUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatShortDateISO } from "@/lib/date";
import type { GradeTask } from "@/lib/grades-server";

/** مهام رفع كشوف الدرجات (تظهر في «مهامي» والرئيسية) */
export function GradesDue({ tasks }: { tasks: GradeTask[] }) {
  if (tasks.length === 0) return null;
  return (
    <Card className="border-warning/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileUp className="size-5 text-warning" /> ارفع درجاتك
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {tasks.map((t) => (
          <Link
            key={`${t.termId}-${t.kind}`}
            href="/app/grades"
            className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted/60"
          >
            <span>
              كشف {t.kind === "midterm" ? "النصفي" : "النهائي"} — {t.termName}
            </span>
            <span className={t.overdue ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
              {t.overdue ? "متأخر" : `حتى ${formatShortDateISO(t.due)}`}
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
