// يبني ملفات صفحات المصحف من بيانات مجمّع الملك فهد (رواية حفص، الإصدار ١٨) ويتحقق منها.
// التشغيل: npm run build:quran  (مرة واحدة؛ الناتج يُرفع مع المشروع)
// المصدر الرسمي: https://qurancomplex.gov.sa/en/techquran/dev/ — النص يُنقل كما هو بلا تعديل.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = "https://raw.githubusercontent.com/thetruetruth/quran-data-kfgqpc/main/hafs";
const DATA_URL = `${BASE}/data/hafsData_v18.json`;
const FONT_URL = `${BASE}/font/hafs.18.woff2`;

type Row = { jozz: number; sora: number; sora_name_ar: string; page: number; aya_no: number; aya_text: string };

const root = process.cwd();
const pagesDir = path.join(root, "public/quran/pages");
const indexFile = path.join(root, "src/lib/quran/index.json");

const stripMarks = (s: string) => s.replace(/[ً-ٰٟۖ-ۭ]/g, "").replace("ٱ", "ا").trim();

async function main() {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`تعذّر تنزيل البيانات: HTTP ${res.status}`);
  const rows = (await res.json()) as Row[];

  const fail = (msg: string) => {
    throw new Error(`فشل التحقق: ${msg}`);
  };
  if (rows.length !== 6236) fail(`عدد الآيات ${rows.length} بدل 6236`);

  const pages = new Map<number, Row[]>();
  const surahs = new Map<number, { n: number; name: string; title: string; page: number; ayas: number }>();
  const juzStart = new Map<number, number>();

  for (const r of rows) {
    if (!pages.has(r.page)) pages.set(r.page, []);
    pages.get(r.page)!.push(r);
    const s = surahs.get(r.sora);
    if (!s) surahs.set(r.sora, { n: r.sora, name: stripMarks(r.sora_name_ar), title: r.sora_name_ar, page: r.page, ayas: 1 });
    else s.ayas++;
    if (!juzStart.has(r.jozz)) juzStart.set(r.jozz, r.page);
  }

  if (pages.size !== 604) fail(`عدد الصفحات ${pages.size} بدل 604`);
  if (surahs.size !== 114) fail(`عدد السور ${surahs.size} بدل 114`);
  if (juzStart.size !== 30) fail(`عدد الأجزاء ${juzStart.size} بدل 30`);
  // نقاط مرجعية من مصحف المدينة
  const checks: [number, number][] = [[1, 1], [2, 2], [18, 293], [36, 440], [67, 562], [114, 604]];
  for (const [n, page] of checks) if (surahs.get(n)?.page !== page) fail(`السورة ${n} تبدأ في ${surahs.get(n)?.page} بدل ${page}`);

  await mkdir(pagesDir, { recursive: true });
  const pageMeta: [number, number][] = [];
  for (let p = 1; p <= 604; p++) {
    const list = pages.get(p);
    if (!list) fail(`الصفحة ${p} مفقودة`);
    const first = list![0];
    pageMeta.push([first.sora, first.jozz]);
    const body = { page: p, juz: first.jozz, ayas: list!.map((r) => ({ s: r.sora, a: r.aya_no, t: r.aya_text })) };
    await writeFile(path.join(pagesDir, `${String(p).padStart(3, "0")}.json`), JSON.stringify(body));
  }

  const font = await fetch(FONT_URL);
  if (!font.ok) throw new Error(`تعذّر تنزيل الخط: HTTP ${font.status}`);
  await writeFile(path.join(root, "src/components/quran/hafs.18.woff2"), Buffer.from(await font.arrayBuffer()));

  await mkdir(path.dirname(indexFile), { recursive: true });
  const index = {
    surahs: [...surahs.values()],
    juz: [...juzStart.entries()].sort((a, b) => a[0] - b[0]).map(([, page]) => page),
    pages: pageMeta,
  };
  await writeFile(indexFile, JSON.stringify(index));
  console.log(`تم: 604 صفحة، 114 سورة، 30 جزءاً، ${rows.length} آية.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
