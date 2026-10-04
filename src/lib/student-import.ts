// استيراد الطلاب من Excel / CSV / جدول منسوخ — دوال نقية تعمل في الواجهة والسيرفر.
import { normalizeArabic, parseGpa, splitSubjects, toAsciiDigits, type Gpa } from "@/lib/academic";

// ---------------------------------------------------------------------
// الأعمدة
// ---------------------------------------------------------------------

export const FIELDS = ["name", "major", "university", "apartment", "year", "phone", "gpa", "struggling", "strong", "email"] as const;
export type Field = (typeof FIELDS)[number];

/** ترتيب الأعمدة إن لم يوجد سطر عناوين: الاسم، التخصص، الجامعة، الشقة، السنة الدراسية، الهاتف، المعدل، المواد المتعثرة */
export const DEFAULT_ORDER: Field[] = ["name", "major", "university", "apartment", "year", "phone", "gpa", "struggling"];

export const FIELD_LABELS: Record<Field, string> = {
  name: "الاسم",
  major: "التخصص",
  university: "الجامعة",
  apartment: "الشقة",
  year: "السنة الدراسية",
  phone: "رقم الهاتف",
  gpa: "المعدل الحالي",
  struggling: "المواد المتعثرة",
  strong: "المواد القوية",
  email: "البريد الإلكتروني",
};

/** يحدّد حقل العمود من عنوانه؛ null إن لم يُفهم */
export function fieldFromHeader(header: string): Field | null {
  const t = normalizeArabic(header);
  if (!t) return null;
  if (/تعثر|ضعيف|تقويه|دعم/.test(t)) return "struggling";
  if (/قوي|متفوق/.test(t)) return "strong";
  if (/بريد|ايميل|email|e-mail|mail/.test(t)) return "email";
  if (/شق|سكن|غرف|apartment|flat/.test(t)) return "apartment";
  if (/هاتف|جوال|موبايل|واتس|phone|mobile|tel|رقم/.test(t)) return "phone";
  if (/معدل|gpa|تراكمي/.test(t)) return "gpa";
  if (/تخصص|قسم|كليه|major/.test(t)) return "major";
  if (/جامع|univers/.test(t)) return "university";
  if (/سنه|مستوي|فرقه|صف|year|level/.test(t)) return "year";
  if (/اسم|name|طالب/.test(t)) return "name";
  return null;
}

/** يربط أعمدة الجدول بالحقول: من سطر العناوين إن وُجد (٣ أعمدة مفهومة على الأقل من بينها الاسم)، وإلا بالترتيب الافتراضي */
export function detectColumns(matrix: string[][]): { fields: (Field | null)[]; hasHeader: boolean } {
  const first = matrix.find((r) => r.some((c) => c.trim()));
  if (first) {
    const mapped = first.map(fieldFromHeader);
    const known = mapped.filter(Boolean);
    if (known.length >= 3 && mapped.includes("name")) {
      // عمود مكرَّر الحقل: الأول يغلب
      const seen = new Set<Field>();
      return { fields: mapped.map((f) => (f && !seen.has(f) ? (seen.add(f), f) : null)), hasHeader: true };
    }
  }
  return { fields: DEFAULT_ORDER, hasHeader: false };
}

// ---------------------------------------------------------------------
// الهاتف
// ---------------------------------------------------------------------

/**
 * أرقام فقط بصيغة دولية بلا + أو 00 (صيغة واتساب).
 * الأرقام التركية المحلية تُكمَّل بمفتاح 90: «0555 123 45 67» و«555 123 45 67».
 */
export function normalizePhone(raw: string): string {
  let d = toAsciiDigits(raw).replace(/\D/g, "");
  d = d.replace(/^00/, "");
  if (/^0\d{10}$/.test(d)) d = "90" + d.slice(1);
  else if (/^5\d{9}$/.test(d)) d = "90" + d;
  return d;
}

export function isValidPhone(digits: string): boolean {
  return digits.length >= 8 && digits.length <= 15;
}

/** رقم قصير غالباً بلا مفتاح الدولة فلن يعمل رابط واتساب */
export function phoneLooksLocal(digits: string): boolean {
  return digits.length <= 9;
}

export const LOGIN_DOMAIN = "yurt.local";

/** اسم الدخول لمن لا بريد له: رقم هاتفه (مثل 905551234567@yurt.local) */
export function loginEmailFromPhone(phone: string): string {
  return `${phone}@${LOGIN_DOMAIN}`;
}

/** ما يكتبه المستخدم في خانة الدخول → البريد الفعلي (الرقم وحده يصير بريداً داخلياً) */
export function resolveLoginIdentifier(input: string): string {
  const t = input.trim();
  if (t.includes("@")) return t;
  const digits = normalizePhone(t);
  return isValidPhone(digits) && /^[\d\s+()-]+$/.test(toAsciiDigits(t)) ? loginEmailFromPhone(digits) : t;
}

/** للعرض: الحساب الداخلي يظهر برقمه لا ببريد وهمي */
export function displayLogin(email: string): string {
  return email.endsWith(`@${LOGIN_DOMAIN}`) ? email.slice(0, -(LOGIN_DOMAIN.length + 1)) : email;
}

// ---------------------------------------------------------------------
// الصفوف
// ---------------------------------------------------------------------

export type ParsedStudentRow = {
  line: number;
  name: string;
  phone: string;
  email: string | null;
  major: string;
  university: string;
  apartmentText: string;
  year: string;
  gpa: Gpa | null;
  gpaText: string;
  strong: string[];
  struggling: string[];
  /** تمنع استيراد الصف */
  errors: string[];
  /** يُستورد الصف مع تنبيه */
  warnings: string[];
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseStudentMatrix(matrix: string[][]): ParsedStudentRow[] {
  const { fields, hasHeader } = detectColumns(matrix);
  const rows: ParsedStudentRow[] = [];
  const seenPhones = new Map<string, number>();
  let headerSkipped = !hasHeader;

  matrix.forEach((cells, i) => {
    if (!cells.some((c) => c.trim())) return;
    if (!headerSkipped) {
      headerSkipped = true;
      return;
    }
    const get = (f: Field) => {
      const idx = fields.indexOf(f);
      return idx >= 0 ? (cells[idx] ?? "").replace(/\s+/g, " ").trim() : "";
    };

    const errors: string[] = [];
    const warnings: string[] = [];

    const name = get("name");
    if (!name) errors.push("الاسم مطلوب");

    const phoneRaw = get("phone");
    const phone = phoneRaw ? normalizePhone(phoneRaw) : "";
    if (!phoneRaw) errors.push("رقم الهاتف مطلوب (هو اسم الدخول)");
    else if (!isValidPhone(phone)) errors.push("رقم الهاتف غير صحيح");
    else if (phoneLooksLocal(phone)) warnings.push("الرقم بلا مفتاح الدولة — قد لا يعمل رابط واتساب");

    if (phone && isValidPhone(phone)) {
      const dupLine = seenPhones.get(phone);
      if (dupLine) errors.push(`الرقم مكرر مع السطر ${dupLine}`);
      else seenPhones.set(phone, i + 1);
    }

    const emailRaw = get("email");
    const email = emailRaw ? emailRaw.toLowerCase() : null;
    if (email && !EMAIL_RE.test(email)) errors.push("البريد الإلكتروني غير صحيح");

    const gpaText = get("gpa");
    const gpa = gpaText ? parseGpa(gpaText) : null;
    if (gpaText && !gpa) warnings.push("المعدل غير مفهوم — يُتجاهل");

    rows.push({
      line: i + 1,
      name,
      phone,
      email: email && EMAIL_RE.test(email) ? email : null,
      major: get("major"),
      university: get("university"),
      apartmentText: get("apartment"),
      year: get("year"),
      gpa,
      gpaText,
      strong: splitSubjects(get("strong")),
      struggling: splitSubjects(get("struggling")),
      errors,
      warnings,
    });
  });
  return rows;
}

// ---------------------------------------------------------------------
// قراءة النصوص
// ---------------------------------------------------------------------

/** جدول منسوخ من Excel/Sheets (tab) أو CSV (فاصلة/فاصلة منقوطة) إلى مصفوفة، مع دعم الحقول المقتبسة */
export function parseDelimited(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = firstLine.includes("\t") ? "\t" : (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      out.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    out.push(row);
  }
  return out;
}

// ---------------------------------------------------------------------
// الشقة
// ---------------------------------------------------------------------

export type ApartmentRef = { id: string; name: string; floor_number: number };
export type ApartmentMatch = { kind: "match"; id: string } | { kind: "none" } | { kind: "ambiguous" } | { kind: "empty" };

/** يطابق نص الشقة: اسم مطابق، أو رقم يطابق رقم الطابق («3» / «شقة 3» / «الطابق الثالث 3») */
export function matchApartment(text: string, apartments: ApartmentRef[]): ApartmentMatch {
  const key = normalizeArabic(toAsciiDigits(text));
  if (!key) return { kind: "empty" };

  const byName = apartments.filter((a) => normalizeArabic(toAsciiDigits(a.name)) === key);
  if (byName.length === 1) return { kind: "match", id: byName[0].id };
  if (byName.length > 1) return { kind: "ambiguous" };

  const stripped = key.replace(/^(ال)?(شقه|طابق|سكن)\s*/, "").trim();
  const byStripped = apartments.filter((a) => normalizeArabic(toAsciiDigits(a.name)).replace(/^(ال)?(شقه|طابق|سكن)\s*/, "").trim() === stripped);
  if (byStripped.length === 1) return { kind: "match", id: byStripped[0].id };
  if (byStripped.length > 1) return { kind: "ambiguous" };

  if (/^\d+$/.test(stripped)) {
    const byFloor = apartments.filter((a) => String(a.floor_number) === stripped);
    if (byFloor.length === 1) return { kind: "match", id: byFloor[0].id };
    if (byFloor.length > 1) return { kind: "ambiguous" };
  }
  return { kind: "none" };
}

// ---------------------------------------------------------------------
// القالب
// ---------------------------------------------------------------------

export const TEMPLATE_HEADERS = ["الاسم", "التخصص", "الجامعة", "الشقة", "السنة الدراسية", "رقم الهاتف", "المعدل الحالي", "المواد المتعثرة"];
