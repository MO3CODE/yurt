// استيراد نتائج سنة دراسية من تقرير (Excel أو جدول منسوخ): فصلان لكل طالب.
// الأعمدة بالترتيب كما في «التقرير الأكاديمي للطلاب»:
// الاسم | الجامعة | ف١ عدد المواد | ف١ ناجح | ف١ راسب | ف١ المعدل | ف٢ عدد المواد | ف٢ ناجح | ف٢ راسب | ف٢ المعدل | المعدل العام
// وتقرير طلاب اللغة: الاسم | المستويات المجتازة | المستوى الحالي | الحالة | موعد الامتحان | ملاحظات
import { normalizeArabic, toAsciiDigits } from "@/lib/academic";
import { inferLanguageStatus, parseLevels, type LanguageStatus } from "@/lib/scholarship";

export type TermResult = { courses: number | null; passed: number | null; failed: number | null; gpa: number };

export type ResultRow = {
  line: number;
  name: string;
  university: string;
  t1: TermResult | null;
  t2: TermResult | null;
  overall: number | null;
  problem: string | null;
  warning: string | null;
};

export const RESULT_HEADERS = [
  "الاسم",
  "الجامعة",
  "ف١ عدد المواد",
  "ف١ ناجح",
  "ف١ راسب",
  "ف١ المعدل",
  "ف٢ عدد المواد",
  "ف٢ ناجح",
  "ف٢ راسب",
  "ف٢ المعدل",
  "المعدل العام",
];

export const LANGUAGE_HEADERS = ["الاسم", "المستويات المجتازة", "المستوى الحالي", "الحالة", "موعد الامتحان", "ملاحظات"];

/** نص ملصوق من Excel/Word (أعمدة مفصولة بـ Tab أو |) ← صفوف */
export function textToMatrix(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => l.split(/\t|\|/).map((c) => c.trim()));
}

const isHeader = (cells: string[]) => /^(ال)?اسم|^name/i.test(normalizeArabic(cells[0] ?? ""));
const blank = (v: string | undefined) => !v || /^[-–—.]+$/.test(v.trim());

function num(v: string | undefined): number | null | "bad" {
  if (blank(v)) return null;
  const n = Number(toAsciiDigits(v as string).replace(",", "."));
  return Number.isFinite(n) ? n : "bad";
}

function termOf(cells: string[], start: number, label: string): { result: TermResult | null; problem: string | null; warning: string | null } {
  const [c, p, f, g] = [num(cells[start]), num(cells[start + 1]), num(cells[start + 2]), num(cells[start + 3])];
  if ([c, p, f, g].includes("bad")) return { result: null, problem: `${label}: رقم غير مفهوم`, warning: null };
  if (g === null) {
    return { result: null, problem: null, warning: c !== null ? `${label}: عدد المواد بلا معدل — لم يُحسب` : null };
  }
  const gpa = g as number;
  if (gpa < 0 || gpa > 4) return { result: null, problem: `${label}: المعدل بين ٠ و٤`, warning: null };
  const ints = [c, p, f] as (number | null)[];
  if (ints.some((x) => x !== null && (!Number.isInteger(x) || x < 0 || x > 30))) return { result: null, problem: `${label}: عدد المواد رقم صحيح`, warning: null };
  const [courses, passed, failed] = ints;
  const warning =
    courses !== null && passed !== null && failed !== null && passed + failed !== courses ? `${label}: الناجح + الراسب لا يساوي عدد المواد` : null;
  return { result: { courses, passed, failed, gpa: Math.round(gpa * 100) / 100 }, problem: null, warning };
}

export function parseResultRows(matrix: string[][]): ResultRow[] {
  const rows: ResultRow[] = [];
  matrix.forEach((cells, i) => {
    if (i === 0 && isHeader(cells)) return;
    const name = (cells[0] ?? "").replace(/\s+/g, " ").trim();
    if (!name) return;
    const a = termOf(cells, 2, "الفصل الأول");
    const b = termOf(cells, 6, "الفصل الثاني");
    const o = num(cells[10]);
    let problem = a.problem ?? b.problem;
    if (o === "bad" || (typeof o === "number" && (o < 0 || o > 4))) problem ??= "المعدل العام غير مفهوم";
    if (!a.result && !b.result && !problem) problem = "لا نتائج لهذا الطالب في التقرير";
    rows.push({
      line: i + 1,
      name,
      university: (cells[1] ?? "").trim(),
      t1: a.result,
      t2: b.result,
      overall: typeof o === "number" ? Math.round(o * 100) / 100 : null,
      problem,
      warning: a.warning ?? b.warning,
    });
  });
  return rows;
}

export type LanguageRow = {
  line: number;
  name: string;
  levelsPassed: string[];
  currentLevel: string | null;
  status: LanguageStatus;
  nextExamAt: string | null;
  notes: string | null;
  problem: string | null;
};

/** المستوى الحالي يقبل رمز مستوى فقط (B2…)، وما سواه («متخرج»، «استعداد…») يُفهم كحالة */
export function parseLanguageRows(matrix: string[][]): LanguageRow[] {
  const rows: LanguageRow[] = [];
  matrix.forEach((cells, i) => {
    if (i === 0 && isHeader(cells)) return;
    const name = (cells[0] ?? "").replace(/\s+/g, " ").trim();
    if (!name) return;
    const currentRaw = (cells[2] ?? "").trim();
    const isLevel = /^[ABC][12]\+?$/i.test(currentRaw);
    const notes = (cells[5] ?? "").replace(/\s+/g, " ").trim() || null;
    const examRaw = toAsciiDigits((cells[4] ?? "").trim());
    const exam = examRaw.match(/^(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    rows.push({
      line: i + 1,
      name,
      levelsPassed: parseLevels(cells[1] ?? ""),
      currentLevel: isLevel ? currentRaw.toUpperCase() : null,
      status: inferLanguageStatus(cells[3], isLevel ? null : currentRaw, notes),
      nextExamAt: exam ? `${exam[1]}-${exam[2].padStart(2, "0")}-${exam[3].padStart(2, "0")}` : null,
      notes,
      problem: examRaw && !exam ? "موعد الامتحان بصيغة 2026-09-01" : null,
    });
  });
  return rows;
}

/** حدود الترمين الأرشيفيين لسنة دراسية تبدأ في خريف startYear */
export function historicalTermDates(startYear: number) {
  return {
    fall: { from: `${startYear}-09-15`, to: `${startYear + 1}-01-31` },
    spring: { from: `${startYear + 1}-02-10`, to: `${startYear + 1}-06-30` },
  };
}
