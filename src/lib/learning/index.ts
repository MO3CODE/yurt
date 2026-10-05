import { addDaysISO, daysBetweenISO } from "@/lib/date";
import { arNum } from "@/lib/quran";

// المنصة التعليمية: الأقسام والمستويات وأنواع الوحدات، وحساب الجدول اليومي للطالب

export const COURSE_CATEGORIES = [
  { key: "academic", label: "المواد الدراسية", description: "شروحات المواد الجامعية" },
  { key: "languages", label: "تقوية اللغات", description: "الإنجليزية وغيرها: قصص وكلمات وكتابة" },
  { key: "personal", label: "المهارات الشخصية", description: "التواصل وإدارة الوقت والقيادة" },
  { key: "professional", label: "مهارات التخصص العملية", description: "برمجة وتصميم وبرامج تخصصية" },
] as const;
export type CourseCategory = (typeof COURSE_CATEGORIES)[number]["key"];
export const CATEGORY_LABELS = Object.fromEntries(COURSE_CATEGORIES.map((c) => [c.key, c.label])) as Record<CourseCategory, string>;
export const isCategory = (v: unknown): v is CourseCategory => COURSE_CATEGORIES.some((c) => c.key === v);

export const COURSE_LEVELS = [
  { key: "beginner", label: "مبتدئ" },
  { key: "intermediate", label: "متوسط" },
  { key: "advanced", label: "متقدم" },
] as const;
export type CourseLevel = (typeof COURSE_LEVELS)[number]["key"];
export const LEVEL_LABELS = Object.fromEntries(COURSE_LEVELS.map((l) => [l.key, l.label])) as Record<CourseLevel, string>;

export type UnitKind = "video" | "reading" | "vocab" | "writing";
export const UNIT_KIND_LABELS: Record<UnitKind, string> = {
  video: "درس فيديو",
  reading: "قراءة",
  vocab: "كلمات للحفظ",
  writing: "تدريب كتابة",
};

/** «١ س ٢٠ د» أو «١٢ د» */
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h > 0) return m > 0 ? `${arNum(h)} س ${arNum(m)} د` : `${arNum(h)} س`;
  return `${arNum(Math.max(1, m))} د`;
}

/** مدد الإنهاء الجاهزة عند الانضمام */
export const TARGET_PRESETS = [
  { days: 7, label: "أسبوع" },
  { days: 14, label: "أسبوعان" },
  { days: 30, label: "شهر" },
  { days: 60, label: "شهران" },
];

export type ScheduleState = "completed" | "on_track" | "behind" | "overdue";

/**
 * الجدول: الوحدات موزّعة بالتساوي على الأيام من البداية إلى موعد الإنهاء.
 * todayCount = ما يجب إنجازه اليوم ليبقى على الجدول (يشمل المتأخر)، behind = المتأخر من الأيام السابقة.
 */
export function courseSchedule(input: { total: number; done: number; startedOn: string; targetDate: string; today: string }) {
  const { total, done, startedOn, targetDate, today } = input;
  const days = Math.max(1, daysBetweenISO(startedOn, targetDate) + 1);
  const expectedBy = (date: string) => {
    const elapsed = Math.min(days, Math.max(0, daysBetweenISO(startedOn, date) + 1));
    return Math.min(total, Math.ceil((total * elapsed) / days));
  };
  const expectedToday = expectedBy(today);
  const expectedYesterday = expectedBy(addDaysISO(today, -1));
  const todayCount = Math.max(0, expectedToday - done);
  const behind = Math.max(0, expectedYesterday - done);
  const perDay = total / days;
  const daysLeft = daysBetweenISO(today, targetDate);

  let state: ScheduleState = "on_track";
  if (done >= total && total > 0) state = "completed";
  else if (daysLeft < 0) state = "overdue";
  else if (behind > 0) state = "behind";

  return { todayCount, behind, perDay, daysLeft, state };
}

/** «٣ دروس يومياً» أو «درس كل يومين تقريباً» */
export function paceLabel(perDay: number): string {
  if (perDay >= 1) {
    const n = Math.round(perDay);
    return n === 1 ? "درس يومياً" : n === 2 ? "درسان يومياً" : `${arNum(n)} دروس يومياً`;
  }
  const every = Math.round(1 / perDay);
  return every === 2 ? "درس كل يومين" : `درس كل ${arNum(every)} أيام`;
}

/** «متأخر بدرس»، «متأخر بدرسين»، «متأخر ٥ دروس» */
export function behindLabel(n: number): string {
  if (n === 1) return "متأخر بدرس";
  if (n === 2) return "متأخر بدرسين";
  return `متأخر ${unitsLabel(n)}`;
}

/** «درس واحد»، «درسان»، «٥ دروس»، «١٢ درساً» */
export function unitsLabel(n: number): string {
  if (n === 1) return "درس واحد";
  if (n === 2) return "درسان";
  if (n <= 10) return `${arNum(n)} دروس`;
  return `${arNum(n)} درساً`;
}

export const youtubeThumb = (videoId: string) => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
