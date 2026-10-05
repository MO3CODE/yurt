"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, RotateCcw, Shuffle, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Segmented } from "@/components/segmented";
import { cn } from "@/lib/utils";
import { arNum } from "@/lib/quran";
import { UnitNavBar, useUnitCompletion } from "@/components/learning/unit-completion";
import { useCanSpeak } from "@/components/learning/reading-unit";
import { speak, type VocabCard } from "@/lib/learning/content";
import { ListenPractice, WritePractice } from "@/components/learning/vocab-practice";

// الكلمات المحفوظة محفوظة في الجهاز لكل درس (الإتمام نفسه يُسجَّل في القاعدة)
const EMPTY: string[] = [];
const cache = new Map<string, string[]>();
const listeners = new Set<() => void>();
function readKnown(key: string): string[] {
  let v = cache.get(key);
  if (!v) {
    try {
      v = JSON.parse(localStorage.getItem(key) ?? "[]") as string[];
    } catch {
      v = [];
    }
    cache.set(key, v);
  }
  return v;
}
function writeKnown(key: string, value: string[]) {
  cache.set(key, value);
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
  listeners.forEach((l) => l());
}
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

const wordsLabel = (n: number) => (n === 1 ? "كلمة واحدة" : n === 2 ? "كلمتان" : n <= 10 ? `${arNum(n)} كلمات` : `${arNum(n)} كلمة`);

export function VocabUnit({
  unitId,
  courseId,
  cards,
  done,
  nextHref,
  prevHref,
}: {
  unitId: string;
  courseId: string;
  cards: VocabCard[];
  done: boolean;
  nextHref: string | null;
  prevHref: string | null;
}) {
  const key = `vocab:${unitId}`;
  const known = useSyncExternalStore(subscribe, () => readKnown(key), () => EMPTY);
  const completion = useUnitCompletion({ unitId, courseId, initialDone: done, nextHref });
  const canSpeak = useCanSpeak();
  const [mode, setMode] = useState<"cards" | "listen" | "write" | "list">("cards");
  const [order, setOrder] = useState(() => cards.map((_, i) => i));
  const [cursor, setCursor] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const knownSet = new Set(known);
  // يُحسب من الكلمات الحالية فقط (لو عدّلت الإدارة كلمة لا تُحسب القديمة)
  const knownCount = cards.filter((c) => knownSet.has(c.word)).length;
  const queue = order.filter((i) => !knownSet.has(cards[i].word));
  const current = queue.length ? cards[queue[cursor % queue.length]] : null;
  const allKnown = queue.length === 0;

  function answer(knowIt: boolean) {
    if (!current) return;
    setFlipped(false);
    if (knowIt) {
      writeKnown(key, [...known, current.word]);
      // آخر كلمة: الدرس مكتمل
      if (knownCount + 1 >= cards.length && !completion.done) completion.markDone("حفظت كل الكلمات، أحسنت ✓");
      // الكلمة خرجت من الطابور فيبقى المؤشر على الموضع نفسه (الكلمة التالية)
    } else {
      setCursor((c) => c + 1);
    }
  }

  function restart() {
    writeKnown(key, []);
    setCursor(0);
    setFlipped(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          label="طريقة العرض"
          value={mode}
          onChange={setMode}
          options={[
            { value: "cards", label: "بطاقات" },
            { value: "listen", label: "استماع" },
            { value: "write", label: "كتابة" },
            { value: "list", label: "القائمة" },
          ]}
        />
        <span className="text-sm text-muted-foreground">
          حفظت {arNum(knownCount)} من {wordsLabel(cards.length)}
        </span>
      </div>
      <Progress value={(knownCount / Math.max(1, cards.length)) * 100} aria-label="الكلمات المحفوظة" />

      {mode === "listen" ? (
        <ListenPractice cards={cards} canSpeak={canSpeak} />
      ) : mode === "write" ? (
        <WritePractice cards={cards} canSpeak={canSpeak} />
      ) : mode === "cards" ? (
        allKnown ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-success/15 text-success">
              <Check className="size-6" />
            </span>
            <p className="font-medium">حفظت كل كلمات هذا الدرس</p>
            <Button variant="outline" size="sm" onClick={restart}>
              <RotateCcw /> راجعها من جديد
            </Button>
          </div>
        ) : (
          current && (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setFlipped((f) => !f)}
                className="group h-64 w-full [perspective:1000px]"
                aria-label={flipped ? "إظهار الكلمة" : "إظهار المعنى"}
              >
                <div
                  className={cn(
                    "relative size-full transition-transform duration-500 [transform-style:preserve-3d]",
                    flipped && "[transform:rotateY(180deg)]"
                  )}
                >
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl border bg-card p-6 shadow-soft [backface-visibility:hidden]">
                    <span className="text-3xl font-semibold" dir="auto">
                      {current.word}
                    </span>
                    <span className="text-xs text-muted-foreground">اضغط لترى المعنى</span>
                  </div>
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl border bg-primary/8 p-6 shadow-soft [backface-visibility:hidden] [transform:rotateY(180deg)]">
                    <span className="text-2xl font-semibold" dir="auto">
                      {current.meaning}
                    </span>
                    {current.example && (
                      <span className="text-sm leading-relaxed text-muted-foreground" dir="auto">
                        {current.example}
                      </span>
                    )}
                    {current.example && canSpeak && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          speak(current.example!);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.stopPropagation();
                            speak(current.example!);
                          }
                        }}
                        className="inline-flex items-center gap-1 rounded-full bg-background/70 px-2.5 py-1 text-xs text-muted-foreground"
                      >
                        <Volume2 className="size-3.5" /> اسمع الجملة
                      </span>
                    )}
                  </div>
                </div>
              </button>

              <div className="flex flex-wrap items-center justify-center gap-2">
                {canSpeak && (
                  <Button variant="ghost" size="sm" onClick={() => speak(current.word)}>
                    <Volume2 /> النطق
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setOrder((o) => [...o].sort(() => Math.random() - 0.5));
                    setCursor(0);
                    setFlipped(false);
                  }}
                >
                  <Shuffle /> خلط
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="lg" onClick={() => answer(false)}>
                  <X /> لم أحفظها بعد
                </Button>
                <Button size="lg" onClick={() => answer(true)}>
                  <Check /> أعرفها
                </Button>
              </div>
              <p className="text-center text-xs text-muted-foreground">تبقّى {wordsLabel(queue.length)}، وما لم تحفظه يعود إليك حتى تحفظه</p>
            </div>
          )
        )
      ) : (
        <ul className="flex flex-col divide-y rounded-2xl border bg-card">
          {cards.map((c) => (
            <li key={c.word} className="flex items-start gap-3 px-3 py-2.5">
              <span className={cn("mt-2 size-2 shrink-0 rounded-full", knownSet.has(c.word) ? "bg-success" : "bg-muted-foreground/30")} />
              <div className="min-w-0 flex-1">
                <p dir="auto">
                  <span className="font-medium">{c.word}</span>
                  <span className="text-muted-foreground"> — {c.meaning}</span>
                </p>
                {c.example && (
                  <p className="text-sm text-muted-foreground" dir="auto">
                    {c.example}
                    {canSpeak && (
                      <button type="button" onClick={() => speak(c.example!)} className="ms-1 align-middle" aria-label="اسمع الجملة">
                        <Volume2 className="inline size-3.5" />
                      </button>
                    )}
                  </p>
                )}
              </div>
              {canSpeak && (
                <Button variant="ghost" size="icon-sm" onClick={() => speak(c.word)} aria-label={`انطق ${c.word}`}>
                  <Volume2 />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <UnitNavBar
        done={completion.done}
        isPending={completion.isPending}
        onComplete={() => completion.markDone()}
        onUndo={completion.undo}
        nextHref={nextHref}
        prevHref={prevHref}
        completeLabel="أنهيت الكلمات"
      />
    </div>
  );
}

