// أدوات المتابعة الأكاديمية — دوال نقية تعمل في الواجهة والسيرفر معاً.
import type { PlanStatus, PlanTrack } from "@/lib/supabase/types";

// ---------------------------------------------------------------------
// نصوص عربية
// ---------------------------------------------------------------------

/** الأرقام الهندية/الفارسية → لاتينية، والفاصلة العشرية العربية → نقطة */
export function toAsciiDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, ".")
    .replace(/٬/g, ",");
}

/** توحيد الهمزات والتاء المربوطة والتشكيل وغيرها للمقارنة بين صيغ الكتابة */
export function normalizeArabic(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** مفتاح مادة: «الرياضيات» و«رياضيات» و«الرياضيّات» تعطي المفتاح نفسه */
export function subjectKey(name: string): string {
  return normalizeArabic(name)
    .split(" ")
    .map((w) => w.replace(/^ال(?=.{2,})/, ""))
    .join(" ");
}

export function splitSubjects(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[،,;؛/|\n]+/)) {
    const name = part.trim().replace(/\s+/g, " ");
    const key = subjectKey(name);
    if (!name || !key || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

// ---------------------------------------------------------------------
// المعدل
// ---------------------------------------------------------------------

export type Gpa = { gpa: number; scale: number };

/** يقبل «3.2» و«٣٫٢» و«3.2/4» و«78». المقياس يُستنتج: ≤٤ ← ٤، ≤٥ ← ٥، غير ذلك ← ١٠٠ */
export function parseGpa(raw: string): Gpa | null {
  const t = toAsciiDigits(raw).replace(/\s+/g, "").replace(",", ".");
  const m = t.match(/^(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?$/);
  if (!m) return null;
  const gpa = Number(m[1]);
  const scale = m[2] ? Number(m[2]) : gpa <= 4 ? 4 : gpa <= 5 ? 5 : 100;
  if (!(scale > 0) || scale > 100 || gpa > scale) return null;
  return { gpa, scale };
}

export const GPA_SCALES = [4, 5, 100] as const;

/** تحت ٥٠٪ من المقياس (مثل ٢٫٠ من ٤) = خطر، وحتى ٦٢٫٥٪ (٢٫٥ من ٤) = مراقبة */
export const RISK_RATIO = 0.5;
export const WATCH_RATIO = 0.625;

export type GpaTone = "none" | "risk" | "watch" | "good";

export function gpaRatio(gpa: number | null | undefined, scale: number | null | undefined): number | null {
  if (gpa === null || gpa === undefined || !scale) return null;
  return Math.min(1, Math.max(0, gpa / scale));
}

export function gpaTone(gpa: number | null | undefined, scale: number | null | undefined): GpaTone {
  const r = gpaRatio(gpa, scale);
  if (r === null) return "none";
  if (r < RISK_RATIO) return "risk";
  if (r < WATCH_RATIO) return "watch";
  return "good";
}

export function formatGpa(gpa: number | null | undefined, scale: number | null | undefined): string {
  if (gpa === null || gpa === undefined || !scale) return "—";
  return scale >= 100 ? `${gpa.toFixed(1)} / ${scale}` : `${gpa.toFixed(2)} / ${scale}`;
}

export const GPA_TONE_CLASSES: Record<GpaTone, { text: string; bar: string; label: string }> = {
  none: { text: "text-muted-foreground", bar: "bg-muted-foreground/30", label: "بلا معدل" },
  risk: { text: "text-destructive", bar: "bg-destructive", label: "يحتاج دعماً" },
  watch: { text: "text-warning-foreground dark:text-warning", bar: "bg-warning", label: "تحت المراقبة" },
  good: { text: "text-success", bar: "bg-success", label: "جيد" },
};

// ---------------------------------------------------------------------
// مطابقة أسماء الطلاب (للاستيراد من جدول)
// ---------------------------------------------------------------------

export type NameMatch = { kind: "match"; id: string } | { kind: "ambiguous" } | { kind: "none" };

/** تطابق تام بعد التوحيد؛ وإلا تطابق كل أجزاء الاسم المكتوب مع طالب واحد فقط (اسم أول + أب مثلاً) */
export function matchStudentByName(input: string, students: { id: string; name: string }[]): NameMatch {
  const key = normalizeArabic(input);
  if (!key) return { kind: "none" };

  const exact = students.filter((s) => normalizeArabic(s.name) === key);
  if (exact.length === 1) return { kind: "match", id: exact[0].id };
  if (exact.length > 1) return { kind: "ambiguous" };

  const tokens = key.split(" ");
  const partial = students.filter((s) => {
    const parts = new Set(normalizeArabic(s.name).split(" "));
    return tokens.every((t) => parts.has(t));
  });
  if (partial.length === 1) return { kind: "match", id: partial[0].id };
  return partial.length > 1 ? { kind: "ambiguous" } : { kind: "none" };
}

// ---------------------------------------------------------------------
// استيراد درجات الطلاب من جدول منسوخ (Excel / Google Sheets)
// الأعمدة: الاسم | المعدل | المواد القوية | المواد المتعثرة
// ---------------------------------------------------------------------

export type ImportRow = {
  line: number;
  name: string;
  gpa: Gpa | null;
  gpaInvalid: boolean;
  strong: string[];
  struggling: string[];
};

export function parseImportText(text: string): ImportRow[] {
  const rows: ImportRow[] = [];
  text
    .split(/\r?\n/)
    .map((l, i) => ({ l, line: i + 1 }))
    .filter(({ l }) => l.trim())
    .forEach(({ l, line }, idx) => {
      const cells = l.split(/\t|\|/).map((c) => c.trim());
      const name = cells[0] ?? "";
      if (idx === 0 && /^(ال)?اسم|^name|^student/.test(normalizeArabic(name))) return; // سطر العناوين
      if (!name) return;
      const gpaRaw = cells[1] ?? "";
      const gpa = gpaRaw ? parseGpa(gpaRaw) : null;
      rows.push({
        line,
        name,
        gpa,
        gpaInvalid: !!gpaRaw && !gpa,
        strong: splitSubjects(cells[2] ?? ""),
        struggling: splitSubjects(cells[3] ?? ""),
      });
    });
  return rows;
}

export const IMPORT_SAMPLE = "الاسم\tالمعدل\tالمواد القوية\tالمواد المتعثرة\nأحمد محمد علي\t3.2\tالبرمجة، الإنجليزية\tالرياضيات، الفيزياء";

// ---------------------------------------------------------------------
// استيراد الخطة من نص (قائمة Word / ملاحظات / Markdown)
// ---------------------------------------------------------------------

export type ParsedPlanItem = {
  track: PlanTrack;
  phase: string | null;
  title: string;
  status: PlanStatus;
  due: string | null;
};

export const TRACK_LABELS: Record<PlanTrack, string> = {
  academic: "أكاديمي",
  skills: "مهاراتي",
  development: "تطويري",
  other: "أخرى",
};

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  todo: "لم يبدأ",
  in_progress: "قيد التنفيذ",
  done: "تم",
  blocked: "متعثّر",
};

function inferTrack(heading: string): PlanTrack | null {
  const t = normalizeArabic(heading);
  if (/اكاديم|دراس|درجات/.test(t)) return "academic";
  if (/مهار/.test(t)) return "skills";
  if (/تطوير|تنميه|شخصي/.test(t)) return "development";
  if (/تقييم|مواد/.test(t)) return "academic";
  return null;
}

const LIST_MARKER = /^\s*(?:[-*•–—▪◦●]|\d+\s*[.)\-–]|[٠-٩]+\s*[.)\-–])\s*/;
const MARK_DONE = /^(?:\[\s*[xX✓✔]\s*\]|[✅☑✔]️?)\s*/u;
const MARK_PROGRESS = /^(?:\[\s*[~/-]\s*\]|[🔄⏳])️?\s*/u;
const MARK_TODO = /^(?:\[\s*\]|[☐⬜□])\s*/u;
const DATE_RE = /(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/;

export function parsePlanText(text: string, defaultTrack: PlanTrack = "other"): ParsedPlanItem[] {
  const items: ParsedPlanItem[] = [];
  let track: PlanTrack = defaultTrack;
  let phase: string | null = null;

  const lines = toAsciiDigits(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const isMarked = (l: string) => LIST_MARKER.test(l) || MARK_DONE.test(l) || MARK_PROGRESS.test(l) || MARK_TODO.test(l);
  // إن كانت الخطة تستخدم نقاطاً أو علامات، فالسطر العادي بينها عنوان (مثل عنوان الوثيقة)؛ وإلا فكل سطر بند
  const usesMarkers = lines.some(isMarked);

  for (let line of lines) {
    const hasListMarker = LIST_MARKER.test(line);
    const hasCheckMarker = MARK_DONE.test(line) || MARK_PROGRESS.test(line) || MARK_TODO.test(line);

    const isHeading =
      /^#{1,6}\s+/.test(line) ||
      (!hasListMarker && !hasCheckMarker && /[:：]\s*$/.test(line)) ||
      (!hasListMarker && !hasCheckMarker && /^(?:المرحلة|المحور|المسار|القسم|الجانب|المجال)(?:\s|$)/.test(line)) ||
      (usesMarkers && !hasListMarker && !hasCheckMarker);

    if (isHeading) {
      const heading = line.replace(/^#{1,6}\s+/, "").replace(/[:：]\s*$/, "").trim();
      if (heading) {
        phase = heading;
        track = inferTrack(heading) ?? track;
      }
      continue;
    }

    line = line.replace(LIST_MARKER, "");
    let status: PlanStatus = "todo";
    if (MARK_DONE.test(line)) {
      status = "done";
      line = line.replace(MARK_DONE, "");
    } else if (MARK_PROGRESS.test(line)) {
      status = "in_progress";
      line = line.replace(MARK_PROGRESS, "");
    } else if (MARK_TODO.test(line)) {
      line = line.replace(MARK_TODO, "");
    }

    if (/\((?:تم|منجز|مكتمل|done)\)\s*$/i.test(line)) {
      status = "done";
      line = line.replace(/\((?:تم|منجز|مكتمل|done)\)\s*$/i, "");
    } else if (/\((?:جار[يٍ]?|قيد التنفيذ|قيد العمل)\)\s*$/.test(line)) {
      status = "in_progress";
      line = line.replace(/\((?:جار[يٍ]?|قيد التنفيذ|قيد العمل)\)\s*$/, "");
    }

    let due: string | null = null;
    const dm = line.match(DATE_RE);
    if (dm) {
      due = `${dm[1]}-${dm[2].padStart(2, "0")}-${dm[3].padStart(2, "0")}`;
      line = line.replace(dm[0], "");
    }

    const title = line
      .replace(/\(\s*\)/g, "")
      .replace(/[\s\-–—:،,]+$/, "")
      .replace(/^[\s\-–—:،,]+/, "")
      .trim();
    if (title.length < 2) continue;

    items.push({ track, phase, title, status, due });
  }
  return items;
}

// ---------------------------------------------------------------------
// تذكيرات واتساب
// ---------------------------------------------------------------------

export type ReminderKind = "session" | "grades" | "tutoring" | "custom";

export const REMINDER_KINDS: { kind: ReminderKind; label: string; hint: string; template: string }[] = [
  {
    kind: "session",
    label: "موعد جلسة تقييم",
    hint: "يُستخدم موعد الجلسة المسجّل لكل طالب",
    template:
      "السلام عليكم ورحمة الله وبركاته {name} 🌿\nنذكّرك بموعد جلسة التقييم الفردية يوم {date}.\nنرجو الحضور في الوقت المحدد، وإحضار ما لديك من درجات ومستجدات دراسية.\nبارك الله فيك ووفّقك.",
  },
  {
    kind: "grades",
    label: "طلب الدرجات",
    hint: "للطلاب الذين لم يُحدَّث ملفهم منذ مدة",
    template:
      "السلام عليكم ورحمة الله {name} 🌿\nحتى نحدّث ملفك الأكاديمي قبل جلستك القادمة، نرجو إرسال درجاتك ونتائجك الأخيرة (الاختبارات والواجبات) في موادك هذا الفصل.\nشكراً لتعاونك.",
  },
  {
    kind: "tutoring",
    label: "حصة تقوية",
    hint: "للمتعثرين في مادة محددة",
    template:
      "السلام عليكم ورحمة الله {name} 🌿\nنظّمنا حصة تقوية في مادة {subject}، وموعدها: {date}.\nنرجو حضورك والالتزام بالموعد، فهي لمصلحتك بإذن الله.",
  },
  {
    kind: "custom",
    label: "رسالة حرّة",
    hint: "اكتب ما تشاء",
    template: "السلام عليكم ورحمة الله {name} 🌿\n",
  },
];

export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);
}

export const REMINDER_VARIABLES = [
  { key: "name", label: "الاسم الأول" },
  { key: "date", label: "الموعد" },
  { key: "subject", label: "المادة" },
] as const;
