"use client";

import { useMemo, useState, useTransition } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Segmented } from "@/components/academic/segmented";
import { importPlanItems } from "@/app/admin/academic/actions";
import { PLAN_STATUS_LABELS, TRACK_LABELS, parsePlanText } from "@/lib/academic";
import { formatShortDateISO } from "@/lib/date";
import type { PlanTrack } from "@/lib/supabase/types";
import { unwrap } from "@/lib/unwrap";
import { toast } from "sonner";

const SAMPLE = `## الجانب الأكاديمي
- [x] رصد درجات جميع الطلاب
- [ ] جلسات التقييم الفردية (2026-11-15)
## الجانب المهاراتي
- [ ] ورشة إدارة الوقت
## الجانب التطويري
- [ ] برنامج القراءة الشهري`;

export function PlanImportDialog({ existingCount }: { existingCount: number }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [defaultTrack, setDefaultTrack] = useState<PlanTrack>("other");
  const [replace, setReplace] = useState(false);
  const [isPending, startTransition] = useTransition();

  const items = useMemo(() => parsePlanText(text, defaultTrack), [text, defaultTrack]);
  const done = items.filter((i) => i.status === "done").length;
  const withDates = items.filter((i) => i.due).length;

  function submit() {
    startTransition(async () => {
      try {
        const count = await unwrap(importPlanItems({ replace, items }));
        toast.success(`رُفع ${count} بند إلى خطتك`);
        setText("");
        setReplace(false);
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر رفع الخطة");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={existingCount === 0 ? "default" : "outline"}><Upload /> رفع الخطة</Button>} />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>رفع خطتك</DialogTitle>
          <DialogDescription>
            الصق خطتك كما هي (من Word أو الملاحظات). تُقرأ العناوين كمجموعات، وكل نقطة أو سطر كبند. علامات اختيارية: <bdi>[x]</bdi> أو ✅
            أو «(تم)» لما أُنجز، <bdi>[~]</bdi> أو «(جارٍ)» لقيد التنفيذ، وتاريخ مثل <bdi>2026-11-15</bdi> كموعد.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            dir="auto"
            placeholder={SAMPLE}
            className="font-mono text-xs leading-relaxed"
            aria-label="الصق خطتك هنا"
          />
          {text.trim() === "" && (
            <button type="button" onClick={() => setText(SAMPLE)} className="w-fit text-xs text-primary hover:underline">
              ضع مثالاً لأرى الصيغة
            </button>
          )}

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">مسار البنود غير المحدَّدة:</span>
            <Segmented
              label="المسار الافتراضي"
              value={defaultTrack}
              onChange={setDefaultTrack}
              options={(["academic", "skills", "development", "other"] as PlanTrack[]).map((t) => ({ value: t, label: TRACK_LABELS[t] }))}
            />
          </div>

          {items.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">
                {items.length} بند · {done} منجز · {withDates} بموعد
              </p>
              <ul className="flex max-h-56 flex-col divide-y overflow-y-auto rounded-xl border text-sm">
                {items.slice(0, 40).map((it, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 p-2.5">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{TRACK_LABELS[it.track]}</span>
                    <span className="min-w-0 flex-1">{it.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {it.status !== "todo" && PLAN_STATUS_LABELS[it.status]}
                      {it.due && ` · ${formatShortDateISO(it.due)}`}
                    </span>
                  </li>
                ))}
                {items.length > 40 && <li className="p-2.5 text-center text-xs text-muted-foreground">و{items.length - 40} بنداً آخر…</li>}
              </ul>
            </div>
          )}

          {existingCount > 0 && (
            <label className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/[0.07] p-3 text-sm">
              <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="mt-1 size-4 accent-[var(--primary)]" />
              <span className="flex flex-col leading-snug">
                <span className="font-medium">استبدال الخطة الحالية ({existingCount} بند)</span>
                <span className="text-xs text-muted-foreground">لإعادة رفع نسخة محدَّثة. غير مفعَّل: تُضاف البنود الجديدة بعد الحالية.</span>
              </span>
            </label>
          )}
        </div>

        <DialogFooter>
          <Button disabled={isPending || items.length === 0} onClick={submit}>
            {isPending && <Spinner />}
            رفع {items.length > 0 ? `${items.length} بند` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
