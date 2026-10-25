import { Languages } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatShortDateISO } from "@/lib/date";
import { LANGUAGE_STATUS_META, type LanguageStatus } from "@/lib/scholarship";

/** سنة اللغة: للطالب في «درجاتي» وللإدارة في ملفه */
export function LanguageProgressCard({
  progress,
}: {
  progress: { levels_passed: string[]; current_level: string | null; status: string; next_exam_at: string | null; notes: string | null };
}) {
  const meta = LANGUAGE_STATUS_META[progress.status as LanguageStatus];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Languages className="size-5 text-primary" /> سنة اللغة
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", meta.className)}>{meta.label}</span>
        </CardTitle>
        {progress.next_exam_at && <CardDescription>الامتحان القادم: {formatShortDateISO(progress.next_exam_at)}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5 text-xs" dir="ltr">
          {progress.levels_passed.map((lv) => (
            <span key={lv} className="rounded-full bg-success/12 px-2 py-0.5 text-success">
              {lv} ✓
            </span>
          ))}
          {progress.current_level && <span className="rounded-full border border-primary/40 px-2 py-0.5 font-semibold text-primary">{progress.current_level}</span>}
        </div>
        {progress.notes && <p className="text-sm leading-relaxed text-muted-foreground">{progress.notes}</p>}
      </CardContent>
    </Card>
  );
}
