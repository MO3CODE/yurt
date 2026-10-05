import { QURAN_PAGES, SURAHS, pageInfo } from "@/lib/quran";

export type HifzStatus = "memorized" | "learning";

/** صفحات السورة في مصحف المدينة: من صفحة بدايتها إلى الصفحة التي قبل السورة التالية (أو التي تبدأ فيها إن بدأت وسط الصفحة) */
export function surahPages(n: number): [from: number, to: number] {
  const from = SURAHS[n - 1].page;
  if (n === 114) return [from, QURAN_PAGES];
  const next = SURAHS[n];
  // إن كانت السورة التالية أول ما في صفحتها فالسورة الحالية تنتهي في الصفحة السابقة
  const to = pageInfo(next.page).surah.n === next.n ? next.page - 1 : next.page;
  return [from, Math.max(from, to)];
}

/** صفحات المحفوظ مرتّبة بلا تكرار */
export function memorizedPages(surahs: number[]): number[] {
  const set = new Set<number>();
  for (const n of surahs) {
    const [from, to] = surahPages(n);
    for (let p = from; p <= to; p++) set.add(p);
  }
  return [...set].sort((a, b) => a - b);
}

/** مراجعة اليوم: count صفحة من الموضع cursor، تدور على المحفوظ */
export function reviewToday(pages: number[], cursor: number, count: number): number[] {
  if (pages.length === 0) return [];
  const n = Math.min(count, pages.length);
  return Array.from({ length: n }, (_, i) => pages[(cursor + i) % pages.length]);
}

export const JUZ_AMMA = Array.from({ length: 114 - 78 + 1 }, (_, i) => 78 + i);
