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
