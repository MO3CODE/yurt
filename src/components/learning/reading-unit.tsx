"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Square, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { UnitNavBar, useUnitCompletion } from "@/components/learning/unit-completion";
import { speak, speechLang, type GlossaryEntry } from "@/lib/learning/content";

const subscribeNone = () => () => {};
/** هل يدعم الجهاز النطق؟ (يُقرأ في المتصفح فقط حتى لا يختلف عن HTML السيرفر) */
export const useCanSpeak = () => useSyncExternalStore(subscribeNone, () => "speechSynthesis" in window, () => false);

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** يقسّم الفقرة إلى نص عادي وكلمات مميّزة (حدود الكلمة بأي لغة) */
function splitByGlossary(text: string, pattern: RegExp | null): (string | { word: string; key: string })[] {
  if (!pattern) return [text];
  const out: (string | { word: string; key: string })[] = [];
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    const i = m.index ?? 0;
    if (i > last) out.push(text.slice(last, i));
    out.push({ word: m[0], key: m[0].toLowerCase() });
    last = i + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function ReadingUnit({
  unitId,
  courseId,
  body,
  glossary,
  done,
  nextHref,
  prevHref,
}: {
  unitId: string;
  courseId: string;
  body: string;
  glossary: GlossaryEntry[];
  done: boolean;
  nextHref: string | null;
  prevHref: string | null;
}) {
  const completion = useUnitCompletion({ unitId, courseId, initialDone: done, nextHref });
  const [active, setActive] = useState<GlossaryEntry | null>(null);
  const [reading, setReading] = useState(false);
  const canSpeak = useCanSpeak();

  const meaningBy = useMemo(() => new Map(glossary.map((g) => [g.word.toLowerCase(), g])), [glossary]);
  const pattern = useMemo(() => {
    if (glossary.length === 0) return null;
    const words = [...glossary].map((g) => g.word).sort((a, b) => b.length - a.length).map(escapeRegex);
    return new RegExp(`(?<![\\p{L}\\p{N}])(?:${words.join("|")})(?![\\p{L}\\p{N}])`, "giu");
  }, [glossary]);
  const paragraphs = useMemo(() => body.split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean), [body]);

  // إيقاف النطق عند مغادرة الدرس
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  function readAloud() {
    if (reading) {
      window.speechSynthesis.cancel();
      setReading(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(body);
    u.lang = speechLang(body);
    u.rate = 0.9;
    u.onend = () => setReading(false);
    u.onerror = () => setReading(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setReading(true);
  }

  return (
    <div className="flex flex-col gap-4">
      {canSpeak && (
        <Button variant="outline" size="sm" className="w-fit" onClick={readAloud}>
          {reading ? <Square /> : <Volume2 />} {reading ? "إيقاف القراءة" : "استمع للنص"}
        </Button>
      )}

      <article className="flex flex-col gap-4 rounded-2xl border bg-card p-4 text-lg leading-loose shadow-soft sm:p-6" dir="auto">
        {paragraphs.map((p, i) => (
          <p key={i}>
            {splitByGlossary(p, pattern).map((part, j) =>
              typeof part === "string" ? (
                part
              ) : (
                <button
                  key={j}
                  type="button"
                  onClick={() => {
                    const entry = meaningBy.get(part.key);
                    if (!entry) return;
                    setActive(entry);
                    speak(entry.word);
                  }}
                  className={cn(
                    "rounded bg-gold/20 px-0.5 font-medium text-foreground underline decoration-gold/70 decoration-dotted underline-offset-4",
                    active?.word.toLowerCase() === part.key && "bg-gold/40"
                  )}
                >
                  {part.word}
                </button>
              )
            )}
          </p>
        ))}
      </article>

      {active && (
        <div className="sticky bottom-24 z-10 flex items-center gap-3 rounded-2xl border bg-popover p-3 shadow-lift md:bottom-4" role="status">
          <div className="min-w-0 flex-1">
            <p className="font-semibold" dir="auto">
              {active.word}
            </p>
            <p className="text-sm text-muted-foreground" dir="auto">
              {active.meaning}
            </p>
          </div>
          {canSpeak && (
            <Button variant="ghost" size="icon-sm" onClick={() => speak(active.word)} aria-label="انطق الكلمة">
              <Volume2 />
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" onClick={() => setActive(null)} aria-label="إغلاق">
            <X />
          </Button>
        </div>
      )}

      {glossary.length > 0 && (
        <section className="flex flex-col gap-2">
          <span className="text-sm font-medium">كلمات النص</span>
          <ul className="grid gap-2 sm:grid-cols-2">
            {glossary.map((g) => (
              <li key={g.word} className="flex items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2">
                <span className="min-w-0">
                  <span className="font-medium" dir="auto">
                    {g.word}
                  </span>
                  <span className="text-sm text-muted-foreground"> — {g.meaning}</span>
                </span>
                {canSpeak && (
                  <Button variant="ghost" size="icon-sm" onClick={() => speak(g.word)} aria-label={`انطق ${g.word}`}>
                    <Volume2 />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <UnitNavBar
        done={completion.done}
        isPending={completion.isPending}
        onComplete={() => completion.markDone("أحسنت، أنهيت القراءة ✓")}
        onUndo={completion.undo}
        nextHref={nextHref}
        prevHref={prevHref}
        completeLabel="أنهيت القراءة"
      />
    </div>
  );
}
