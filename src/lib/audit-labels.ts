// تسميات عربية لسجل النشاط (audit_log)

export const AUDIT_TABLE_LABELS: Record<string, string> = {
  profiles: "حساب",
  students: "بيانات طالب",
  apartments: "شقة",
  attendance_records: "حضور",
  prayer_records: "صلاة",
  quran_wird_logs: "ورد",
  complaints: "شكوى",
  academic_support_requests: "طلب دعم أكاديمي",
  health_records: "سجل صحي",
  cleaning_tasks: "مهمة نظافة",
  cleaning_assignments: "توزيع نظافة",
  points_entries: "نقاط",
  notifications: "إشعار",
  facilities: "مرفق",
  facility_issues: "بلاغ عطل",
  alerts: "تنبيه",
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  INSERT: "أضاف",
  UPDATE: "عدّل",
  DELETE: "حذف",
};

const FIELD_LABELS: Record<string, string> = {
  status: "الحالة",
  role: "الدور",
  permissions: "الصلاحيات",
  full_name: "الاسم",
  phone: "الجوال",
  apartment_id: "الشقة",
  supervisor_id: "المشرف",
  university_name: "الجامعة",
  major: "التخصص",
  academic_year: "السنة الدراسية",
  notes: "الملاحظات",
  admin_response: "رد الإدارة",
  supervisor_response: "رد المشرف",
  admin_notes: "ملاحظات الإدارة",
  assigned_to_name: "المتابِع",
  points: "النقاط",
  reason: "السبب",
  name: "الاسم",
  title: "العنوان",
  resolved: "محلول",
  severity: "الخطورة",
  priority: "الأولوية",
  student_id: "الطالب",
  emergency_contact_name: "جهة الطوارئ",
  emergency_contact_phone: "هاتف الطوارئ",
};

const VALUE_LABELS: Record<string, string> = {
  active: "نشط",
  on_leave: "في إجازة",
  graduated: "متخرّج",
  withdrawn: "منسحب",
  new: "جديدة",
  triaged: "قيد المراجعة",
  in_progress: "قيد المعالجة",
  escalated: "مُصعّدة",
  resolved: "تم الحل",
  rejected: "مرفوضة",
  open: "مفتوح",
  assigned: "مُسند",
  closed: "مغلق",
  present: "حاضر",
  absent: "غائب",
  late: "متأخر",
  excused: "بعذر",
  pending: "بانتظار التنفيذ",
  done: "تمّت",
  missed: "لم تُنفَّذ",
  admin: "إداري",
  super_admin: "مدير عام",
  student: "طالب",
  true: "نعم",
  false: "لا",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatValue(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return "فارغ";
  if (Array.isArray(v)) return `${v.length} عنصر`;
  if (typeof v === "object") return null;
  const s = String(v);
  if (UUID.test(s)) return null; // معرّفات داخلية لا تعني شيئاً للقارئ
  if (VALUE_LABELS[s]) return VALUE_LABELS[s];
  return s.length > 40 ? s.slice(0, 40) + "…" : s;
}

/** سطور مختصرة لما تغيّر في تعديل: «الحالة: جديدة ← تم الحل» */
export function describeChanges(action: string, changes: unknown): string[] {
  if (action !== "UPDATE" || !changes || typeof changes !== "object") return [];
  const lines: string[] = [];
  for (const [key, diff] of Object.entries(changes as Record<string, { from: unknown; to: unknown }>)) {
    const label = FIELD_LABELS[key];
    if (!label) continue;
    const from = formatValue(diff?.from);
    const to = formatValue(diff?.to);
    lines.push(from && to ? `${label}: ${from} ← ${to}` : `${label}: تغيّر`);
  }
  return lines;
}
