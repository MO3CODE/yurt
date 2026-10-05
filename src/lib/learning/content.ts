import type { Json } from "@/lib/supabase/types";

// محتوى وحدات القراءة والكلمات في course_units.content
// القراءة: {"glossary": [{word, meaning}]}، الكلمات: {"cards": [{word, meaning, example}]}

export type VocabCard = { word: string; meaning: string; example?: string };
export type GlossaryEntry = { word: string; meaning: string };

const MAX_CARDS = 200;

function arrayField(content: Json | null, key: string): unknown[] {
  if (!content || typeof content !== "object" || Array.isArray(content)) return [];
  const v = (content as Record<string, unknown>)[key];
  return Array.isArray(v) ? v : [];
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function vocabCards(content: Json | null): VocabCard[] {
  return arrayField(content, "cards")
    .map((c) => {
      const o = (c ?? {}) as Record<string, unknown>;
      const example = str(o.example);
      return { word: str(o.word), meaning: str(o.meaning), ...(example ? { example } : {}) };
    })
    .filter((c) => c.word && c.meaning);
}

export function readingGlossary(content: Json | null): GlossaryEntry[] {
  return arrayField(content, "glossary")
    .map((c) => {
      const o = (c ?? {}) as Record<string, unknown>;
      return { word: str(o.word), meaning: str(o.meaning) };
    })
    .filter((c) => c.word && c.meaning);
}

/**
 * سطر لكل كلمة: «الكلمة | المعنى | مثال» — يقبل أيضاً الفاصل Tab (لصق من Excel).
 * المثال اختياري؛ الأسطر الناقصة تُتجاهل.
 */
export function parseCardLines(text: string): VocabCard[] {
  const seen = new Set<string>();
  const out: VocabCard[] = [];
  for (const line of text.split("\n")) {
    const parts = line.split(/\t|\s*\|\s*/).map((p) => p.trim());
    const [word, meaning, ...rest] = parts;
    if (!word || !meaning) continue;
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const example = rest.join(" | ").trim();
    out.push({ word, meaning, ...(example ? { example } : {}) });
    if (out.length >= MAX_CARDS) break;
  }
  return out;
}

export const cardsToLines = (cards: { word: string; meaning: string; example?: string }[]) =>
  cards.map((c) => [c.word, c.meaning, c.example].filter(Boolean).join(" | ")).join("\n");

/** لغة النطق: لاتيني ← إنجليزي، وإلا عربي */
export const speechLang = (text: string) => (/[a-z]/i.test(text) ? "en-US" : "ar-SA");

export function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = speechLang(text);
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
  return true;
}
