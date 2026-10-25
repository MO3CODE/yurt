// مسودات مواد الكشف: تحويل صفوف النموذج إلى قيم للإرسال ومعاينة المعدل كما سيحسبه النظام
// (ملف عادي لا "use client" حتى تستدعيه صفحات السيرفر أيضاً)
import { parseGpa, type ReportKind } from "@/lib/grades";
import { classifyCourse, computeTermGpa, type GradeScale, type ScholarshipSettings } from "@/lib/scholarship";

export type CourseDraft = {
  name: string;
  code: string;
  credits: string;
  letter: string;
  percent: string;
  isRepeat: boolean;
  help: boolean;
};

export type CourseInputValue = {
  courseName: string;
  courseCode: string | null;
  credits: number;
  letter: string | null;
  percent: number | null;
  isRepeat: boolean;
  helpRequested: boolean;
};

export const emptyCourse = (): CourseDraft => ({ name: "", code: "", credits: "", letter: "", percent: "", isRepeat: false, help: false });

export function draftFromCourse(c: {
  course_name: string;
  course_code: string | null;
  credits: number;
  letter: string | null;
  percent: number | null;
  is_repeat: boolean;
  help_requested: boolean;
}): CourseDraft {
  return {
    name: c.course_name,
    code: c.course_code ?? "",
    credits: String(c.credits),
    letter: c.letter ?? "",
    percent: c.percent === null ? "" : String(c.percent),
    isRepeat: c.is_repeat,
    help: c.help_requested,
  };
}

/** يحوّل المسودات إلى قيم للإرسال، أو يرجع رسالة الخطأ الأولى */
export function parseCourses(rows: CourseDraft[], kind: ReportKind): { courses: CourseInputValue[] } | { error: string } {
  const filled = rows.filter((r) => r.name.trim() || r.credits.trim() || r.letter || r.percent.trim());
  if (filled.length === 0) return { error: "أضف موادك هذا الترم (اسم المادة وساعاتها ودرجتها)" };
  const courses: CourseInputValue[] = [];
  for (const [i, r] of filled.entries()) {
    const n = i + 1;
    if (r.name.trim().length < 2) return { error: `اكتب اسم المادة ${n}` };
    const credits = parseGpa(r.credits);
    if (credits === null || Number.isNaN(credits) || credits <= 0 || credits > 30) return { error: `ساعات «${r.name.trim()}» رقم مثل 3` };
    let percent: number | null = null;
    if (kind === "final" && !r.letter) return { error: `اختر درجة «${r.name.trim()}»` };
    if (kind === "midterm" && r.percent.trim()) {
      percent = parseGpa(r.percent);
      if (percent === null || Number.isNaN(percent) || percent < 0 || percent > 100) return { error: `درجة «${r.name.trim()}» نسبة بين ٠ و١٠٠` };
    }
    courses.push({
      courseName: r.name.trim().replace(/\s+/g, " "),
      courseCode: r.code.trim() || null,
      credits,
      letter: kind === "final" ? r.letter : null,
      percent,
      isRepeat: r.isRepeat,
      helpRequested: r.help,
    });
  }
  return { courses };
}

/** المعدل الفصلي وتصنيف كل صف كما سيحسبه النظام */
export function previewCourses(rows: CourseDraft[], kind: ReportKind, scale: GradeScale, settings: ScholarshipSettings) {
  const classified = rows.map((r) => {
    const credits = parseGpa(r.credits);
    const percent = r.percent.trim() ? parseGpa(r.percent) : null;
    return classifyCourse(
      {
        name: r.name,
        credits: credits && !Number.isNaN(credits) ? credits : 0,
        letter: r.letter || null,
        percent: percent !== null && !Number.isNaN(percent) ? percent : null,
      },
      kind,
      scale,
      settings
    );
  });
  return { classified, ...computeTermGpa(classified) };
}
