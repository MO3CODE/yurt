import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { arNum } from "@/lib/quran";
import { behindLabel, type ScheduleState } from "@/lib/learning";

/** حالة الطالب في جدول الكورس */
export function ScheduleBadge({ state, behind, className }: { state: ScheduleState; behind: number; className?: string }) {
  const map: Record<ScheduleState, { label: string; tone: string }> = {
    completed: { label: "مكتمل ✓", tone: "bg-success/15 text-success" },
    on_track: { label: "على الجدول", tone: "bg-primary/12 text-primary" },
    behind: {
      label: behindLabel(behind),
      tone: "bg-warning/20 text-warning-foreground dark:text-warning",
    },
    overdue: { label: "تجاوز الموعد", tone: "bg-destructive/12 text-destructive" },
  };
  const { label, tone } = map[state];
  return <Badge className={cn(tone, className)}>{label}</Badge>;
}

export const daysLeftLabel = (days: number) =>
  days < 0 ? "انتهى الموعد" : days === 0 ? "آخر يوم" : days === 1 ? "يوم واحد متبقٍ" : `${arNum(days)} ${days <= 10 ? "أيام" : "يوماً"} متبقية`;
