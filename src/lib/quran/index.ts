import data from "./index.json";

// فهرس مصحف المدينة (٦٠٤ صفحة) مولَّد من بيانات مجمّع الملك فهد عبر npm run build:quran
export const QURAN_PAGES = 604;

export type Surah = { n: number; name: string; title: string; page: number; ayas: number };
export type QuranAya = { s: number; a: number; t: string };
export type QuranPage = { page: number; juz: number; ayas: QuranAya[] };

export const SURAHS = data.surahs as Surah[];
/** صفحة بداية كل جزء: JUZ_START_PAGES[0] = الجزء ١ */
export const JUZ_START_PAGES = data.juz as number[];
const PAGE_META = data.pages as [surah: number, juz: number][];

export function clampPage(page: number): number {
  return Math.min(QURAN_PAGES, Math.max(1, Math.trunc(page) || 1));
}

/** السورة والجزء في أول الصفحة */
export function pageInfo(page: number): { surah: Surah; juz: number } {
  const [surah, juz] = PAGE_META[clampPage(page) - 1];
  return { surah: SURAHS[surah - 1], juz };
}

export function pageUrl(page: number): string {
  return `/quran/pages/${String(clampPage(page)).padStart(3, "0")}.json`;
}

const arabicNumber = new Intl.NumberFormat("ar-u-nu-arab", { useGrouping: false });
export const arNum = (n: number) => arabicNumber.format(n);

/** «يوم واحد»، «يومين»، «٥ أيام»، «٣٠ يوماً» */
export function daysLabel(n: number): string {
  if (n === 1) return "يوم واحد";
  if (n === 2) return "يومين";
  if (n <= 10) return `${arNum(n)} أيام`;
  return `${arNum(n)} يوماً`;
}

/** وصف نطاق صفحات مقروءة من المنصة: «الكهف (ص ٢٩٣–٢٩٧)» أو «ص ٤، ٢٩٣–٢٩٤» */
export function describePages(pages: number[]): string {
  if (pages.length === 0) return "";
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const runs: [number, number][] = [];
  for (const p of sorted) {
    const last = runs.at(-1);
    if (last && p === last[1] + 1) last[1] = p;
    else runs.push([p, p]);
  }
  const span = runs.map(([a, b]) => (a === b ? arNum(a) : `${arNum(a)}–${arNum(b)}`)).join("، ");
  const first = pageInfo(sorted[0]).surah.name;
  const last = pageInfo(sorted.at(-1)!).surah.name;
  const surahs = first === last ? first : `${first} – ${last}`;
  return `${surahs} (ص ${span})`;
}

/** «صفحة واحدة»، «صفحتان»، «٥ صفحات»، «٢٠ صفحة» */
export function pagesLabel(n: number): string {
  if (n === 1) return "صفحة واحدة";
  if (n === 2) return "صفحتان";
  if (n <= 10) return `${arNum(n)} صفحات`;
  return `${arNum(n)} صفحة`;
}

/** النطاق المتبقي من العلامة: «من ص ٢٩٥ إلى ٢٩٧ (الإسراء – الكهف)» */
export function pageSpan(from: number, count: number): string {
  const start = clampPage(from);
  const end = Math.min(QURAN_PAGES, start + count - 1);
  const a = pageInfo(start).surah.name;
  const b = pageInfo(end).surah.name;
  const surahs = a === b ? a : `${a} – ${b}`;
  return start === end ? `ص ${arNum(start)} (${surahs})` : `من ص ${arNum(start)} إلى ${arNum(end)} (${surahs})`;
}

/** مصدر ورد اليوم من عدد صفحات المنصة وصفحات المصحف الورقي */
export type WirdSource = "platform" | "mushaf" | "both";
export function wirdSource(platformPages: number, mushafLogged: boolean): WirdSource | null {
  if (platformPages > 0 && mushafLogged) return "both";
  if (platformPages > 0) return "platform";
  if (mushafLogged) return "mushaf";
  return null;
}

export const WIRD_SOURCE_LABELS: Record<WirdSource, string> = {
  platform: "منصة",
  mushaf: "مصحف",
  both: "كلاهما",
};
