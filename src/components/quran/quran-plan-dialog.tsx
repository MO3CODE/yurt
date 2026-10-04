"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { unwrap } from "@/lib/unwrap";
import { setQuranPlan } from "@/app/app/quran/actions";
import { JUZ_START_PAGES, QURAN_PAGES, SURAHS, arNum, daysLabel, pageInfo } from "@/lib/quran";

const GOAL_PRESETS = [
  { pages: 1, label: "صفحة" },
  { pages: 2, label: "صفحتان" },
  { pages: 5, label: "نصف حزب" },
  { pages: 10, label: "حزب" },
  { pages: 20, label: "جزء" },
];

const surahItems = SURAHS.map((s) => ({ value: String(s.n), label: `${arNum(s.n)}. ${s.name}` }));
const juzItems = JUZ_START_PAGES.map((_, i) => ({ value: String(i + 1), label: `الجزء ${arNum(i + 1)}` }));

export function QuranPlanDialog({
  trigger,
  bookmark,
  dailyGoal,
}: {
  trigger: React.ReactElement;
  bookmark: number;
  dailyGoal: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(bookmark);
  const [surahValue, setSurahValue] = useState<string | null>(null);
  const [juzValue, setJuzValue] = useState<string | null>(null);
  const [pageText, setPageText] = useState(String(bookmark));
  const [goalText, setGoalText] = useState(dailyGoal ? String(dailyGoal) : "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const goal = goalText.trim() === "" ? null : Number(goalText);
  const goalValid = goal === null || (Number.isInteger(goal) && goal >= 1 && goal <= QURAN_PAGES);
  const days = goal && goalValid ? Math.ceil((QURAN_PAGES - start + 1) / goal) : null;

  function reset() {
    setStart(bookmark);
    setSurahValue(null);
    setJuzValue(null);
    setPageText(String(bookmark));
    setGoalText(dailyGoal ? String(dailyGoal) : "");
    setError(null);
  }

  function pickStart(page: number, from: "surah" | "juz" | "page") {
    setStart(page);
    if (from !== "surah") setSurahValue(null);
    if (from !== "juz") setJuzValue(null);
    if (from !== "page") setPageText(String(page));
  }

  function save() {
    if (!goalValid) {
      setError("اكتب عدد صفحات بين ١ و٦٠٤، أو اتركه فارغاً");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        // لا نلمس العلامة إن لم يغيّر الطالب نقطة البدء
        await unwrap(setQuranPlan({ start: start === bookmark ? null : start, dailyGoal: goal }));
        toast.success("حُفظت خطة وردك");
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "تعذّر الحفظ");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) reset();
        setOpen(o);
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>خطة وردي</DialogTitle>
          <DialogDescription>حدد من أين تبدأ ختمتك وكم صفحة تقرأ كل يوم</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-2.5">
            <Label>أبدأ من</Label>
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={surahValue}
                onValueChange={(v) => {
                  if (!v) return;
                  setSurahValue(v);
                  pickStart(SURAHS[Number(v) - 1].page, "surah");
                }}
                items={surahItems}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="سورة" />
                </SelectTrigger>
                <SelectContent>
                  {surahItems.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={juzValue}
                onValueChange={(v) => {
                  if (!v) return;
                  setJuzValue(v);
                  pickStart(JUZ_START_PAGES[Number(v) - 1], "juz");
                }}
                items={juzItems}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="جزء" />
                </SelectTrigger>
                <SelectContent>
                  {juzItems.map((j) => (
                    <SelectItem key={j.value} value={j.value}>
                      {j.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="plan-page" className="shrink-0 font-normal text-muted-foreground">
                أو صفحة
              </Label>
              <Input
                id="plan-page"
                type="number"
                inputMode="numeric"
                min={1}
                max={QURAN_PAGES}
                value={pageText}
                onChange={(e) => {
                  setPageText(e.target.value);
                  const n = Number(e.target.value);
                  if (Number.isInteger(n) && n >= 1 && n <= QURAN_PAGES) pickStart(n, "page");
                }}
                className="w-28"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {start === bookmark ? "تبقى علامتك عند" : "ستنتقل علامتك إلى"} صفحة {arNum(start)} — سورة{" "}
              {pageInfo(start).surah.name}
            </p>
          </section>

          <section className="flex flex-col gap-2.5">
            <Label htmlFor="plan-goal">وردي اليومي</Label>
            <div className="flex flex-wrap gap-2">
              {GOAL_PRESETS.map((p) => (
                <Button
                  key={p.pages}
                  type="button"
                  size="sm"
                  variant={goal === p.pages ? "default" : "outline"}
                  onClick={() => setGoalText(String(p.pages))}
                >
                  {p.label}
                  {p.pages > 2 && <span className="opacity-70">({arNum(p.pages)})</span>}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Input
                id="plan-goal"
                type="number"
                inputMode="numeric"
                min={1}
                max={QURAN_PAGES}
                placeholder="عدد آخر"
                value={goalText}
                onChange={(e) => setGoalText(e.target.value)}
                aria-invalid={!goalValid}
                className="w-28"
              />
              <span className="text-sm text-muted-foreground">صفحة يومياً</span>
            </div>
            <p className={cn("text-sm", days ? "text-foreground" : "text-muted-foreground")}>
              {days
                ? `تختم بإذن الله خلال ${daysLabel(days)} من صفحة ${arNum(start)}`
                : "بلا ورد يومي محدد"}
            </p>
          </section>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={isPending}>
            {isPending && <Spinner />}
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
