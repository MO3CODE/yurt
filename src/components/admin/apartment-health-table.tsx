import Link from "next/link";
import { MessageSquareWarning } from "lucide-react";
import { ProgressRing } from "@/components/progress-ring";
import { cn } from "@/lib/utils";

type HealthRow = {
  apartment_id: string | null;
  name: string | null;
  floor_number: number | null;
  cleaning_score: number | null;
  prayer_score: number | null;
  attendance_score: number | null;
  open_complaints: number | null;
  overall_score: number | null;
};

function tone(score: number) {
  if (score >= 80) return { text: "text-success", bar: "bg-success", label: "ممتاز" };
  if (score >= 50) return { text: "text-warning", bar: "bg-warning", label: "يحتاج متابعة" };
  return { text: "text-destructive", bar: "bg-destructive", label: "حرج" };
}

function Metric({ label, value }: { label: string; value: number }) {
  const t = tone(value);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("animate-grow-x h-full rounded-full", t.bar)} style={{ width: `${Math.max(3, value)}%` }} />
      </div>
    </div>
  );
}

/** بطاقات صحة الشقق: مؤشر عام دائري + ثلاثة أشرطة (النظافة/الصلاة/الحضور) */
export function ApartmentHealthTable({ rows }: { rows: HealthRow[] }) {
  return (
    <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => {
        const overall = row.overall_score ?? 0;
        const t = tone(overall);
        return (
          <Link
            key={row.apartment_id}
            href={`/admin/apartments/${row.apartment_id}`}
            className="card-interactive group flex flex-col gap-4 rounded-2xl border bg-card p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-center gap-4">
              <ProgressRing value={overall} size={60} stroke={6} className={t.text}>
                <span className="font-heading text-base font-semibold tabular-nums">{overall}</span>
              </ProgressRing>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-heading text-base font-semibold group-hover:text-primary">{row.name}</span>
                <span className="text-xs text-muted-foreground">الطابق {row.floor_number}</span>
                <span className={cn("text-xs font-medium", t.text)}>{t.label}</span>
              </div>
              {(row.open_complaints ?? 0) > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning-foreground dark:text-warning">
                  <MessageSquareWarning className="size-3" /> {row.open_complaints}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2.5">
              <Metric label="النظافة" value={row.cleaning_score ?? 0} />
              <Metric label="الصلاة" value={row.prayer_score ?? 0} />
              <Metric label="الحضور" value={row.attendance_score ?? 0} />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
