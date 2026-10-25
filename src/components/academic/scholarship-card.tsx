import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StudentScaleSelect } from "@/components/academic/scholarship-settings-form";
import { cn } from "@/lib/utils";
import { formatGpa } from "@/lib/grades";
import {
  AWARD_STATUS_LABELS,
  FLAG_LABELS,
  PRIORITY_META,
  STATUS_META,
  SUPPORT_STATUS_LABELS,
  TIER_META,
  type AwardStatus,
  type AwardTier,
  type StandingFlag,
  type StandingStatus,
  type SupportPriority,
} from "@/lib/scholarship";

export type ScholarshipCardData = {
  studentId: string;
  scaleKey: string;
  scales: { key: string; name: string }[];
  standings: { termName: string; termGpa: number | null; cumGpa: number | null; status: StandingStatus; flags: StandingFlag[]; source: string }[];
  awards: { termName: string; tier: AwardTier; amount: number; currency: string; status: AwardStatus }[];
  support: { id: string; subject: string; status: string; priority: SupportPriority | null; termName: string | null }[];
};

/** المنحة في ملف الطالب: حالته في كل ترم، جوائزه، وطلبات دعمه */
export function ScholarshipCard({ data }: { data: ScholarshipCardData }) {
  const latest = data.standings[0];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          المنحة
          {latest && <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", STATUS_META[latest.status].className)}>{STATUS_META[latest.status].label}</span>}
        </CardTitle>
        <CardDescription>{latest ? STATUS_META[latest.status].hint : "تظهر الحالة بعد تأكيد أول كشف نهائي بمواده"}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          سلّم درجات جامعته
          <StudentScaleSelect studentId={data.studentId} value={data.scaleKey} scales={data.scales} />
        </label>

        {data.standings.length > 0 && (
          <ul className="flex flex-col divide-y text-sm">
            {data.standings.map((s) => (
              <li key={s.termName} className="flex flex-col gap-0.5 py-2">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{s.termName}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_META[s.status].className)}>{STATUS_META[s.status].label}</span>
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatGpa(s.termGpa)} فصلي · {formatGpa(s.cumGpa)} تراكمي{s.source === "calculated" ? " (محسوب — غير رسمي)" : ""}
                  {s.flags.length > 0 && <span className="text-destructive"> · {s.flags.map((f) => FLAG_LABELS[f]).join(" · ")}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}

        {data.awards.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">جوائز التميز</span>
            {data.awards.map((a) => (
              <span key={a.termName} className={cn("w-fit rounded-full px-2.5 py-1 text-xs", TIER_META[a.tier].className, a.status === "cancelled" && "opacity-50")}>
                {TIER_META[a.tier].medal} {a.termName} · {a.amount} {a.currency} · {AWARD_STATUS_LABELS[a.status]}
              </span>
            ))}
          </div>
        )}

        {data.support.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Link href="/admin/academic/support" className="text-xs font-medium text-muted-foreground hover:underline">
              طلبات الدعم
            </Link>
            <ul className="flex flex-col gap-1">
              {data.support.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    {r.subject}
                    {r.termName && <span className="text-xs text-muted-foreground"> · {r.termName}</span>}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {r.priority && <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", PRIORITY_META[r.priority].className)}>{PRIORITY_META[r.priority].label}</span>}
                    <span className="text-xs text-muted-foreground">{SUPPORT_STATUS_LABELS[r.status] ?? r.status}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
