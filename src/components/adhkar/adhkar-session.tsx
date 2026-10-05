"use client";

import { useRef, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { BookCheck, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { hafsFont } from "@/components/quran/hafs-font";
import { cn } from "@/lib/utils";
import { completeAdhkar } from "@/app/app/adhkar/actions";
import { ADHKAR_PERIODS, PERIOD_LABELS, adhkarFor, countLabel, type AdhkarPeriod, type Dhikr } from "@/lib/adhkar";
import { BASMALA, arNum } from "@/lib/quran";

// عدّادات اليوم محفوظة في الجهاز (لكل يوم وفترة)، فلا يضيع التقدم عند الخروج والرجوع
type Counts = Record<number, number>;
const EMPTY: Counts = {};
const PREFIX = "adhkar:";
const cache = new Map<string, Counts>();
const listeners = new Set<() => void>();

function readCounts(key: string): Counts {
  let v = cache.get(key);
  if (!v) {
    try {
      v = JSON.parse(localStorage.getItem(key) ?? "{}") as Counts;
      // تنظيف عدّادات الأيام السابقة
      const day = key.split(":")[1];
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k?.startsWith(PREFIX) && k.split(":")[1] !== day) localStorage.removeItem(k);
      }
    } catch {
      v = {};
    }
    cache.set(key, v);
  }
  return v;
}
function writeCounts(key: string, value: Counts) {
  cache.set(key, value);
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function AdhkarSession({
  day,
  initialPeriod,
  done: initialDone,
}: {
  day: string;
  initialPeriod: AdhkarPeriod;
  done: Record<AdhkarPeriod, boolean>;
}) {
  const [period, setPeriod] = useState<AdhkarPeriod>(initialPeriod);
  const [done, setDone] = useState(initialDone);

  return (
    <Tabs value={period} onValueChange={(v) => setPeriod(v as AdhkarPeriod)}>
      <TabsList className="w-full sm:w-fit">
        {ADHKAR_PERIODS.map((p) => (
          <TabsTrigger key={p} value={p}>
            {PERIOD_LABELS[p]}
            {done[p] && <Check className="text-success" />}
          </TabsTrigger>
        ))}
      </TabsList>
      {ADHKAR_PERIODS.map((p) => (
        <TabsContent key={p} value={p}>
          <PeriodList day={day} period={p} done={done[p]} onDone={() => setDone((d) => ({ ...d, [p]: true }))} />
        </TabsContent>
      ))}
      <p className="pt-2 text-center text-[11px] text-muted-foreground">
        النصوص من «حصن المسلم» للشيخ سعيد بن وهف القحطاني، والآيات من مصحف المدينة (مجمّع الملك فهد)
      </p>
    </Tabs>
  );
}

function PeriodList({
  day,
  period,
  done,
  onDone,
}: {
  day: string;
  period: AdhkarPeriod;
  done: boolean;
  onDone: () => void;
}) {
  const key = `${PREFIX}${day}:${period}`;
  const counts = useSyncExternalStore(subscribe, () => readCounts(key), () => EMPTY);
  const [isPending, startTransition] = useTransition();
  const submitted = useRef(false);
  const list = adhkarFor(period);

  const completeCount = list.filter((d) => (counts[d.id] ?? 0) >= d.count).length;
  const allDone = completeCount === list.length;

  function submit(method: "counter" | "manual") {
    if (submitted.current && method === "counter") return;
    submitted.current = true;
    startTransition(async () => {
      const r = await completeAdhkar({ period, method });
      if (!r.ok) {
        submitted.current = false;
        toast.error(r.error);
        return;
      }
      onDone();
      toast.success(`تقبّل الله، أتممت ${PERIOD_LABELS[period]}`);
    });
  }

  function tap(d: Dhikr) {
    const current = counts[d.id] ?? 0;
    if (current >= d.count) return;
    const next = { ...counts, [d.id]: current + 1 };
    writeCounts(key, next);
    if (current + 1 < d.count) return;

    navigator.vibrate?.(15);
    const remaining = list.filter((x) => (next[x.id] ?? 0) < x.count);
    if (remaining.length === 0) {
      if (!done) submit("counter");
      return;
    }
    // الانتقال للذكر التالي غير المكتمل
    const nextOpen = remaining.find((x) => x.id > d.id) ?? remaining[0];
    window.setTimeout(() => {
      document.getElementById(`dhikr-${period}-${nextOpen.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 250);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-2 z-10 flex flex-col gap-2 rounded-2xl border bg-card/95 p-3 shadow-soft backdrop-blur sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm">
            {done ? (
              <span className="inline-flex items-center gap-1 font-medium text-success">
                <Check className="size-4" /> أتممت {PERIOD_LABELS[period]} اليوم
              </span>
            ) : (
              <>
                <span className="font-semibold tabular-nums">
                  {arNum(completeCount)} / {arNum(list.length)}
                </span>{" "}
                <span className="text-muted-foreground">ذكراً</span>
              </>
            )}
          </p>
          <div className="flex items-center gap-1">
            {!done && !allDone && (
              <Button variant="ghost" size="sm" onClick={() => submit("manual")} disabled={isPending}>
                {isPending ? <Spinner /> : <BookCheck />} قرأتها من كتيّب أو حفظي
              </Button>
            )}
            {completeCount > 0 && (
              <Button variant="ghost" size="icon-sm" aria-label="تصفير العدّاد" onClick={() => writeCounts(key, {})}>
                <RotateCcw />
              </Button>
            )}
          </div>
        </div>
        <Progress value={(completeCount / list.length) * 100} aria-label="تقدّم الأذكار" />
      </div>

      {list.map((d) => (
        <DhikrCard key={d.id} id={`dhikr-${period}-${d.id}`} dhikr={d} count={counts[d.id] ?? 0} onTap={() => tap(d)} />
      ))}
    </div>
  );
}

function DhikrCard({ id, dhikr, count, onTap }: { id: string; dhikr: Dhikr; count: number; onTap: () => void }) {
  const complete = count >= dhikr.count;
  const progress = Math.min(1, count / dhikr.count);
  const r = 15;
  const c = 2 * Math.PI * r;

  return (
    <div
      id={id}
      className={cn(
        "overflow-hidden rounded-2xl border bg-card shadow-soft transition-[opacity,border-color] duration-300",
        complete && "border-success/40 opacity-70"
      )}
    >
      <button
        type="button"
        onClick={onTap}
        disabled={complete}
        aria-label={complete ? "اكتمل هذا الذكر" : `اضغط للعدّ، ${arNum(count)} من ${arNum(dhikr.count)}`}
        className="flex w-full flex-col gap-4 p-4 text-start transition-colors active:bg-muted/60 disabled:cursor-default sm:p-5"
      >
        {dhikr.quran ? (
          <div className="flex flex-col gap-2">
            <span className="w-fit rounded-full bg-gold/15 px-2.5 py-0.5 text-xs font-medium text-gold-foreground dark:text-gold">
              {dhikr.quran.title}
            </span>
            {dhikr.quran.intro && <p className="text-base text-muted-foreground">{dhikr.quran.intro}</p>}
            <div className={cn(hafsFont.className, "text-[1.35rem] leading-[2.2]")}>
              {dhikr.quran.basmala && <p className="text-center">{BASMALA}</p>}
              <p>{dhikr.quran.ayas.map((a) => `${a.t} `)}</p>
            </div>
          </div>
        ) : (
          <p className="text-lg leading-[2.1]">{dhikr.text}</p>
        )}

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">{countLabel(dhikr.count)}</span>
          <span className="relative flex size-10 items-center justify-center">
            <svg viewBox="0 0 36 36" className="absolute inset-0 size-10 -rotate-90" aria-hidden>
              <circle cx="18" cy="18" r={r} fill="none" strokeWidth="2.5" className="stroke-muted" />
              <circle
                cx="18"
                cy="18"
                r={r}
                fill="none"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={c * (1 - progress)}
                className={cn("transition-[stroke-dashoffset] duration-300", complete ? "stroke-success" : "stroke-primary")}
              />
            </svg>
            {complete ? (
              <Check className="size-4 text-success" />
            ) : (
              <span className="text-xs font-semibold tabular-nums">{arNum(dhikr.count - count)}</span>
            )}
          </span>
        </div>
      </button>

      {(dhikr.fadl || dhikr.source) && (
        <div className="flex flex-col gap-1 border-t bg-muted/30 px-4 py-2.5 text-xs leading-relaxed text-muted-foreground sm:px-5">
          {dhikr.fadl && <p>{dhikr.fadl}</p>}
          {dhikr.source && (
            <details>
              <summary className="cursor-pointer select-none text-foreground/70">المصدر</summary>
              <p className="pt-1">{dhikr.source}</p>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
