"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Lightbulb, RotateCcw, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { arNum } from "@/lib/quran";
import { speak, type VocabCard } from "@/lib/learning/content";

// تدريبات الكلمات: الاستماع (اسمع واختر المعنى) والكتابة (اقرأ المعنى واكتب الكلمة).
// الترتيب والخيارات من مولّد عشوائي ببذرة محفوظة في الحالة، فالعرض نفسه ثابت بين السيرفر والمتصفح.

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffled<T>(list: T[], seed: number): T[] {
  const r = rng(seed);
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^\p{L}\p{N}' -]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

/** المثال مع إخفاء الكلمة (وصيغها البسيطة) */
function blankExample(example: string | undefined, word: string): string | null {
  if (!example) return null;
  const first = word.split(" ")[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const stem = first.length > 4 ? first.slice(0, -1) : first;
  const re = new RegExp(`\\b${stem}\\p{L}*(?:\\s+\\p{L}+){${word.split(" ").length - 1}}`, "iu");
  return re.test(example) ? example.replace(re, "_____") : null;
}

function useRound(cards: VocabCard[]) {
  const [state, setState] = useState({ seed: 1, index: 0, correct: 0, answered: 0 });
  const order = useMemo(() => shuffled(cards.map((_, i) => i), state.seed), [cards, state.seed]);
  const finished = state.index >= order.length;
  const current = finished ? null : cards[order[state.index]];
  return {
    ...state,
    total: order.length,
    current,
    finished,
    record: (ok: boolean) => setState((s) => ({ ...s, correct: s.correct + (ok ? 1 : 0), answered: s.answered + 1 })),
    next: () => setState((s) => ({ ...s, index: s.index + 1 })),
    restart: () => setState((s) => ({ seed: s.seed + 7919, index: 0, correct: 0, answered: 0 })),
  };
}

function Score({ correct, total, onRestart }: { correct: number; total: number; onRestart: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-8 text-center">
      <p className="text-lg font-semibold">
        {arNum(correct)} من {arNum(total)} إجابة صحيحة
      </p>
      <p className="text-sm text-muted-foreground">
        {correct === total ? "ممتاز! أتقنت كلمات هذا الدرس" : correct >= total * 0.7 ? "جيد جداً، أعد التدريب لتتقنها كلها" : "راجع البطاقات ثم أعد التدريب"}
      </p>
      <Button variant="outline" size="sm" onClick={onRestart}>
        <RotateCcw /> تدريب جديد
      </Button>
    </div>
  );
}

/** اسمع الكلمة واختر معناها من أربعة خيارات */
export function ListenPractice({ cards, canSpeak }: { cards: VocabCard[]; canSpeak: boolean }) {
  const round = useRound(cards);
  const [picked, setPicked] = useState<string | null>(null);

  const options = round.current
    ? shuffled(
        [
          round.current.meaning,
          ...shuffled(
            cards.filter((c) => c.meaning !== round.current!.meaning).map((c) => c.meaning),
            round.seed * 31 + round.index
          ).slice(0, 3),
        ],
        round.seed * 17 + round.index
      )
    : [];

  if (!canSpeak) return <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">جهازك لا يدعم النطق، جرّب تدريب الكتابة.</p>;
  if (round.finished) return <Score correct={round.correct} total={round.total} onRestart={round.restart} />;
  const current = round.current!;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          السؤال {arNum(round.index + 1)} من {arNum(round.total)}
        </span>
        <span>صحيح: {arNum(round.correct)}</span>
      </div>
      <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-6">
        <Button size="lg" className="size-16 rounded-full" onClick={() => speak(current.word)} aria-label="اسمع الكلمة">
          <Volume2 className="size-7" />
        </Button>
        <span className="text-sm text-muted-foreground">اضغط لتسمع الكلمة، ثم اختر معناها</span>
        {picked && (
          <span className="text-lg font-semibold" dir="ltr">
            {current.word}
          </span>
        )}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
        {options.map((o) => {
          const isRight = o === current.meaning;
          return (
            <button
              key={o}
              type="button"
              disabled={picked !== null}
              onClick={() => {
                setPicked(o);
                round.record(isRight);
              }}
              className={cn(
                "rounded-xl border px-3 py-3 text-sm transition-colors",
                picked === null && "hover:bg-muted/50",
                picked !== null && isRight && "border-success bg-success/10 font-medium text-success",
                picked === o && !isRight && "border-destructive bg-destructive/10 text-destructive"
              )}
            >
              {o}
            </button>
          );
        })}
      </div>
      {picked && (
        <Button
          className="self-center"
          onClick={() => {
            setPicked(null);
            round.next();
          }}
        >
          التالي
        </Button>
      )}
    </div>
  );
}

/** اقرأ المعنى (والجملة بلا الكلمة) واكتب الكلمة بالإنجليزية */
export function WritePractice({ cards, canSpeak }: { cards: VocabCard[]; canSpeak: boolean }) {
  const round = useRound(cards);
  const [value, setValue] = useState("");
  const [result, setResult] = useState<"right" | "wrong" | null>(null);
  const [hint, setHint] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);

  if (round.finished) return <Score correct={round.correct} total={round.total} onRestart={round.restart} />;
  const current = round.current!;
  const blanked = blankExample(current.example, current.word);

  function check() {
    if (!value.trim() || result) return;
    const ok = normalize(value) === normalize(current.word);
    setResult(ok ? "right" : "wrong");
    round.record(ok);
    if (canSpeak) speak(current.word);
  }

  function next() {
    setValue("");
    setResult(null);
    setHint(false);
    round.next();
    setTimeout(() => input.current?.focus(), 0);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          السؤال {arNum(round.index + 1)} من {arNum(round.total)}
        </span>
        <span>صحيح: {arNum(round.correct)}</span>
      </div>
      <div className="flex flex-col gap-2 rounded-2xl border bg-card p-5 text-center">
        <span className="text-xs text-muted-foreground">اكتب بالإنجليزية الكلمة التي معناها</span>
        <span className="text-2xl font-semibold">{current.meaning}</span>
        {blanked && (
          <span className="text-sm text-muted-foreground" dir="ltr">
            {blanked}
          </span>
        )}
        {hint && !result && (
          <span className="text-sm text-gold" dir="ltr">
            {current.word[0]}
            {"·".repeat(Math.max(0, current.word.length - 1))} (
            {current.word.length <= 10 ? `${arNum(current.word.length)} أحرف` : `${arNum(current.word.length)} حرفاً`})
          </span>
        )}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (result) next();
          else check();
        }}
      >
        <Input
          ref={input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          dir="ltr"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="type the word"
          aria-label="الكلمة بالإنجليزية"
          readOnly={result !== null}
          className={cn(
            "h-11 text-base",
            result === "right" && "border-success bg-success/10",
            result === "wrong" && "border-destructive bg-destructive/10"
          )}
        />
        <Button type="submit" className="h-11">
          {result ? "التالي" : "تحقّق"}
        </Button>
      </form>
      {result === "wrong" && (
        <p className="flex items-center justify-center gap-1.5 text-sm">
          <X className="size-4 text-destructive" /> الصحيح:{" "}
          <span className="font-semibold" dir="ltr">
            {current.word}
          </span>
        </p>
      )}
      {result === "right" && (
        <p className="flex items-center justify-center gap-1.5 text-sm text-success">
          <Check className="size-4" /> أحسنت!
        </p>
      )}
      {!result && (
        <div className="flex justify-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setHint(true)} disabled={hint}>
            <Lightbulb /> تلميح
          </Button>
          {canSpeak && (
            <Button variant="ghost" size="sm" onClick={() => speak(current.word)}>
              <Volume2 /> اسمعها
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
