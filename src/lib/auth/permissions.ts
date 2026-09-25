// صلاحيات الإداريين حسب الأقسام. المدير العام (super_admin) يملكها كلها ضمنياً،
// وإدارة الفريق نفسها حكر عليه. الملف آمن للاستيراد من الواجهة والسيرفر.

export const PERMISSION_GROUPS = [
  {
    label: "الطلاب والشقق",
    items: [
      { key: "students", label: "الطلاب", description: "إضافة الطلاب وتعديل بياناتهم وإعادة كلمات المرور" },
      { key: "apartments", label: "الشقق والمشرفون", description: "إدارة الشقق وتعيين مشرفيها" },
    ],
  },
  {
    label: "المتابعة اليومية",
    items: [
      { key: "attendance", label: "الحضور الجامعي", description: "متابعة حضور الطلاب" },
      { key: "prayers", label: "الصلوات", description: "متابعة التزام الصلاة" },
      { key: "quran", label: "الورد القرآني", description: "متابعة الورد والحفظ" },
      { key: "health", label: "السجل الصحي", description: "الاطلاع على الحالات الصحية" },
    ],
  },
  {
    label: "الدعم والمتابعة",
    items: [
      { key: "academic", label: "الدعم الأكاديمي", description: "استقبال طلبات التقوية ومتابعتها" },
      { key: "complaints", label: "الشكاوى والمقترحات", description: "الرد على الشكاوى وتغيير حالتها" },
    ],
  },
  {
    label: "السكن والمرافق",
    items: [
      { key: "cleaning", label: "جدول النظافة", description: "إنشاء مهام النظافة وتوزيعها" },
      { key: "facilities", label: "المرافق", description: "إدارة المرافق وبلاغات الأعطال" },
    ],
  },
  {
    label: "التحفيز والتقارير",
    items: [
      { key: "points", label: "النقاط", description: "منح النقاط ولوحة الشرف" },
      { key: "alerts", label: "التنبيهات", description: "التنبيهات التي تستدعي الانتباه" },
      { key: "notifications", label: "الإشعارات", description: "إرسال الإشعارات للطلاب" },
      { key: "reports", label: "التقارير", description: "التقارير الدورية للمتبرعين" },
    ],
  },
] as const;

export type PermissionKey = (typeof PERMISSION_GROUPS)[number]["items"][number]["key"];

export const ALL_PERMISSIONS: PermissionKey[] = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));

const LABELS = new Map<string, string>(PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => [i.key, i.label] as const)));

export function permissionLabel(key: string): string {
  return LABELS.get(key) ?? key;
}

export function isPermissionKey(value: unknown): value is PermissionKey {
  return typeof value === "string" && LABELS.has(value);
}

/** قوالب جاهزة لأدوار شائعة عند إضافة إداري */
export const PERMISSION_PRESETS: { label: string; permissions: PermissionKey[] }[] = [
  { label: "كامل الصلاحيات", permissions: ALL_PERMISSIONS },
  { label: "المتابعة اليومية", permissions: ["students", "attendance", "prayers", "quran", "health", "alerts"] },
  { label: "الشؤون الأكاديمية", permissions: ["students", "attendance", "academic", "reports"] },
  { label: "السكن والمرافق", permissions: ["apartments", "cleaning", "facilities", "complaints"] },
  { label: "التحفيز والتواصل", permissions: ["points", "notifications", "alerts"] },
];

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "مدير عام",
  admin: "إداري",
  student: "طالب",
};
