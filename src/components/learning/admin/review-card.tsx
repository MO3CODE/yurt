"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { reviewSubmission } from "@/app/admin/learning/actions";
import { arNum } from "@/lib/quran";
import { WRITING_STATUS_LABELS, type WritingStatus } from "@/lib/learning/writing";
import { unwrap } from "@/lib/unwrap";

export type ReviewItem = {
  id: string;
  studentName: string;
  courseId: string;
  courseTitle: string;
  unitTitle: string;
  topic: string;
  note: string | null;
  status: WritingStatus;
  feedback: string | null;
  createdAt: string;
  images: string[];
};

export function ReviewCard({ item }: { item: ReviewItem }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState(item.feedback ?? "");
  const [busy, setBusy] = useState<"approved" | "revise" | null>(null);
  const [, startTransition] = useTransition();

  function review(status: "approved" | "revise") {
    setBusy(status);
    startTransition(async () => {
      try {
        await unwrap(reviewSubmission({ id: item.id, status, feedback }));
        toast.success(status === "approved" ? `قُبلت كتابة ${item.studentName}` : `أُعيدت لـ${item.studentName} مع ملاحظاتك`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر الحفظ");
      } finally {
        setBusy(null);
      }
    });
  }

  return (
    <article className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-soft">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{item.studentName}</span>
          <span className="text-xs text-muted-foreground">
            <Link href={`/admin/learning/${item.courseId}`} className="hover:underline">
              {item.courseTitle}
            </Link>{" "}
            · {item.unitTitle} · {new Date(item.createdAt).toLocaleDateString("ar-u-nu-arab", { day: "numeric", month: "long" })}
          </span>
        </div>
        <Badge variant={item.status === "pending" ? "outline" : "secondary"}>{WRITING_STATUS_LABELS[item.status]}</Badge>
      </header>

      <p className="text-sm" dir="auto">
        <span className="text-muted-foreground">الموضوع: </span>
        {item.topic}
      </p>
      {item.note && <p className="rounded-lg bg-muted/60 p-2.5 text-sm">ملاحظة الطالب: {item.note}</p>}

      <div className="flex flex-wrap gap-2">
        {item.images.map((src, i) => (
          <a key={i} href={src} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border" title="فتح بالحجم الكامل">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`الصفحة ${arNum(i + 1)}`} className="h-40 w-auto max-w-full object-contain" />
          </a>
        ))}
      </div>

      <Textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        rows={3}
        maxLength={4000}
        placeholder="ملاحظاتك للطالب: الأخطاء، ما أحسن فيه، ما يحتاج تحسيناً…"
        dir="auto"
        aria-label="الملاحظات"
      />
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => review("approved")} disabled={busy !== null}>
          {busy === "approved" ? <Spinner /> : <Check />} قبول
        </Button>
        <Button variant="outline" onClick={() => review("revise")} disabled={busy !== null}>
          {busy === "revise" ? <Spinner /> : <RotateCcw />} يحتاج إعادة
        </Button>
      </div>
    </article>
  );
}
