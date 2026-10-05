"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { BookOpen, Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Segmented } from "@/components/segmented";
import { cn } from "@/lib/utils";
import { unwrap } from "@/lib/unwrap";
import { markReviewDone, setHifzStatus, setReviewPages } from "@/app/app/quran/hifz-actions";
import { QURAN_PAGES, SURAHS, arNum, describePages, pagesLabel, surahsLabel } from "@/lib/quran";
import { JUZ_AMMA, memorizedPages, reviewToday, surahPages, type HifzStatus } from "@/lib/quran/hifz";
import { normalizeArabic } from "@/lib/quran/search";

const REVIEW_OPTIONS = [1, 2, 3, 5, 10, 20];
const OFF = 0;

export function HifzPanel({
  initial,
  reviewPages: initialReviewPages,
  cursor: initialCursor,
  reviewedToday: initialReviewedToday,
}: {
  initial: { surah: number; status: HifzStatus }[];
  reviewPages: number | null;
  cursor: number;
  reviewedToday: boolean;
}) {
  const [statusBy, setStatusBy] = useState(() => new Map(initial.map((h) => [h.surah, h.status])));
  const [reviewPages, setReviewPagesState] = useState(initialReviewPages);
  const [cursor, setCursor] = useState(initialCursor);
  const [reviewedToday, setReviewedToday] = useState(initialReviewedToday);
  const [filter, setFilter] = useState("");
  const [isPending, startTransition] = useTransition();

  const memorized = [...statusBy.entries()].filter(([, s]) => s === "memorized").map(([n]) => n);
  const learning = [...statusBy.entries()].filter(([, s]) => s === "learning").map(([n]) => n);
  const pages = memorizedPages(memorized);
  const review = reviewPages ? reviewToday(pages, cursor % Math.max(1, pages.length), reviewPages) : [];

  function update(surahs: number[], status: HifzStatus | null) {
    const prev = statusBy;
    const next = new Map(statusBy);
    for (const n of surahs) {
      if (status) next.set(n, status);
      else next.delete(n);
    }
    setStatusBy(next);
    startTransition(async () => {
      try {
        await unwrap(setHifzStatus({ surahs, status }));
      } catch (e) {
        setStatusBy(prev);
        toast.error(e instanceof Error ? e.message : "تعذّر الحفظ");
      }
    });
  }

  function changeReview(v: number) {
    const value = v === OFF ? null : v;
    const prev = reviewPages;
    setReviewPagesState(value);
    startTransition(async () => {
      try {
        await unwrap(setReviewPages(value));
      } catch (e) {
        setReviewPagesState(prev);
        toast.error(e instanceof Error ? e.message : "تعذّر الحفظ");
      }
    });
  }

  function done() {
    startTransition(async () => {
      try {
        const r = await unwrap(markReviewDone(pages.length));
        setCursor(r.cursor);
        setReviewedToday(true);
        toast.success("بارك الله فيك، سُجّلت مراجعة اليوم");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر الحفظ");
      }
    });
  }

  const q = normalizeArabic(filter);
  const visible = SURAHS.filter((s) => !q || normalizeArabic(s.name).includes(q));

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2 rounded-xl border bg-card p-4">
        <p className="text-sm">
          {memorized.length > 0 ? (
            <>
              تحفظ <span className="font-semibold">{surahsLabel(memorized.length)}</span> ({pagesLabel(pages.length)} من{" "}
              {arNum(QURAN_PAGES)})
            </>
          ) : (
            "علّم السور التي تحفظها لتبدأ المراجعة اليومية"
          )}
        </p>
        <Progress value={(pages.length / QURAN_PAGES) * 100} aria-label="نسبة المحفوظ" />
        {learning.length > 0 && (
          <p className="text-xs text-muted-foreground">تحفظ الآن: {learning.map((n) => SURAHS[n - 1].name).join("، ")}</p>
        )}
      </section>

      {pages.length > 0 && (
        <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-medium">المراجعة اليومية</span>
            <Segmented
              label="صفحات المراجعة يومياً"
              value={reviewPages ?? OFF}
              onChange={changeReview}
              options={[{ value: OFF, label: "إيقاف" }, ...REVIEW_OPTIONS.map((n) => ({ value: n, label: `${arNum(n)} ص` }))]}
            />
          </div>
          {reviewPages && (
            <>
              <p className="leading-relaxed">
                <span className="text-muted-foreground">مراجعة اليوم: </span>
                {describePages(review)}
              </p>
              <p className="text-xs text-muted-foreground">
                تختم مراجعة محفوظك كل {arNum(Math.ceil(pages.length / reviewPages))}{" "}
                {Math.ceil(pages.length / reviewPages) <= 10 ? "أيام" : "يوماً"}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/app/quran/read?page=${review[0]}`} />}>
                  <BookOpen /> افتح في المصحف
                </Button>
                {reviewedToday ? (
                  <span className="inline-flex items-center gap-1 px-2 text-sm text-success">
                    <Check className="size-4" /> راجعت اليوم
                  </span>
                ) : (
                  <Button size="sm" onClick={done} disabled={isPending}>
                    <Check /> راجعتها
                  </Button>
                )}
              </div>
            </>
          )}
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium">السور</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => update(JUZ_AMMA, "memorized")}
            disabled={isPending || JUZ_AMMA.every((n) => statusBy.get(n) === "memorized")}
          >
            أحفظ جزء عمّ كاملاً
          </Button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="ابحث عن سورة" className="ps-9" aria-label="ابحث عن سورة" />
        </div>
        <ul className="flex max-h-[28rem] flex-col divide-y overflow-y-auto">
          {visible.map((s) => {
            const st = statusBy.get(s.n) ?? null;
            const [from, to] = surahPages(s.n);
            return (
              <li key={s.n} className="flex items-center justify-between gap-2 py-2">
                <span className={cn("flex min-w-0 items-center gap-2", st === "memorized" && "text-success")}>
                  <span className="w-6 text-center text-xs text-muted-foreground tabular-nums">{arNum(s.n)}</span>
                  <span className="truncate">{s.name}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{pagesLabel(to - from + 1)}</span>
                </span>
                <Segmented
                  label={`حالة سورة ${s.name}`}
                  value={st ?? "none"}
                  onChange={(v) => update([s.n], v === "none" ? null : (v as HifzStatus))}
                  options={[
                    { value: "none", label: "—" },
                    { value: "learning", label: "أحفظها الآن" },
                    { value: "memorized", label: "حفظتها", className: "text-success" },
                  ]}
                />
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
