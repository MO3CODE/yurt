// البحث في نص المصحف الإملائي: توحيد الحروف وحذف التشكيل حتى تتطابق «إن» و«ان» و«الرحمٰن» و«الرحمن»
export type SearchRow = [surah: number, aya: number, page: number, text: string];

export function normalizeArabic(s: string): string {
  return s
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

export type SearchHit = { surah: number; aya: number; page: number; text: string; start: number; end: number };

/** يرجع حتى limit نتيجة بترتيب المصحف، مع موضع التطابق في النص الموحَّد للتظليل */
export function searchQuran(rows: { norm: string; row: SearchRow }[], query: string, limit = 50): { hits: SearchHit[]; total: number } {
  const q = normalizeArabic(query);
  if (q.length < 2) return { hits: [], total: 0 };
  const hits: SearchHit[] = [];
  let total = 0;
  for (const { norm, row } of rows) {
    const i = norm.indexOf(q);
    if (i === -1) continue;
    total++;
    if (hits.length < limit) hits.push({ surah: row[0], aya: row[1], page: row[2], text: norm, start: i, end: i + q.length });
  }
  return { hits, total };
}
