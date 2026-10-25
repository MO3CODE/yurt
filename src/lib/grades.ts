import { z } from "zod";
import { arNum } from "@/lib/quran";

// كشوف الدرجات: ترمات بفترتي رفع (النصفي والنهائي)، والطالب يرفع ملفه ويكتب معدله

export const GRADES_BUCKET = "grade-reports";
export const MAX_GRADE_FILES = 5;

export type ReportKind = "midterm" | "final";
export const REPORT_KINDS: ReportKind[] = ["midterm", "final"];
export const KIND_LABELS: Record<ReportKind, string> = { midterm: "النصفي (Vize)", final: "النهائي (Final)" };

export type AcademicTerm = {
  id: string;
  name: string;
  midterm_from: string;
  midterm_to: string;
  final_from: string;
  final_to: string;
  /** ترم أرشيفي: نتائجه مستوردة من تقرير، فلا رفع فيه */
  historical?: boolean;
};

export type WindowState = "upcoming" | "open" | "closed";

export function windowOf(term: AcademicTerm, kind: ReportKind) {
  return kind === "midterm" ? { from: term.midterm_from, to: term.midterm_to } : { from: term.final_from, to: term.final_to };
}

export function windowState(term: AcademicTerm, kind: ReportKind, today: string): WindowState {
  const { from, to } = windowOf(term, kind);
  if (today < from) return "upcoming";
  if (today > to) return "closed";
  return "open";
}

/** يُقبل الرفع منذ فتح الفترة (والمتأخر يُرفع أيضاً ويُعلَّم متأخراً) */
export const canSubmit = (term: AcademicTerm, kind: ReportKind, today: string) => today >= windowOf(term, kind).from;

/** «٣٫٢٥» */
export const formatGpa = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : new Intl.NumberFormat("ar-u-nu-arab", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

/** «١٢» أو «٣٫٥» ساعة */
export const formatCredits = (n: number) => new Intl.NumberFormat("ar-u-nu-arab", { maximumFractionDigits: 1 }).format(n);

/** يقبل «3.25» أو «3,25» أو «٣٫٢٥» */
export function parseGpa(raw: string): number | null {
  const s = raw
    .trim()
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[٫,]/g, ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

export const filesLabel = (n: number) => (n === 1 ? "ملف واحد" : n === 2 ? "ملفان" : `${arNum(n)} ملفات`);

/** مادة في الكشف كما يرسلها الطالب (أو تصحّحها الإدارة) */
export const courseSchema = z.object({
  courseName: z.string().trim().min(2, "اكتب اسم المادة").max(120),
  courseCode: z.string().trim().max(20).nullable(),
  credits: z.number().positive("الساعات رقم موجب").max(30),
  letter: z.string().trim().max(4).nullable(),
  percent: z.number().min(0).max(100).nullable(),
  isRepeat: z.boolean(),
  helpRequested: z.boolean(),
});
