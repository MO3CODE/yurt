// ملاحظة: لا نخزّن هنا مكوّنات الأيقونات نفسها (LucideIcon) لأنها تُستورد من ملف
// عادي يمر عبر Server Components — تمرير مرجع مكوّن (function/forwardRef) كـ prop
// من Server Component إلى Client Component غير مسموح في React (فقط بيانات قابلة
// للتسلسل). لذلك نخزّن اسم الأيقونة كنص، وخريطة الأسماء إلى المكوّنات موجودة في
// sidebar-nav.tsx (وهو "use client") حيث يُسمح باستيراد المكوّنات فعلياً.
import type { PermissionKey } from "@/lib/auth/permissions";

export type IconName =
  | "ShieldCheck"
  | "LayoutDashboard"
  | "Users"
  | "DoorOpen"
  | "ClipboardCheck"
  | "HandHeart"
  | "BookOpen"
  | "Stethoscope"
  | "GraduationCap"
  | "MessageSquareWarning"
  | "SprayCan"
  | "Building2"
  | "Trophy"
  | "BellRing"
  | "Siren"
  | "FileBarChart"
  | "CalendarDays"
  | "ListTodo";

export type NavItem = {
  title: string;
  href: string;
  icon: IconName;
  /** الصلاحية المطلوبة لرؤية القسم (للإداريين) */
  permission?: PermissionKey;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const adminNav: NavGroup[] = [
  {
    label: "الرئيسية",
    items: [{ title: "لوحة التحكم", href: "/admin", icon: "LayoutDashboard" }],
  },
  {
    label: "الطلاب والشقق",
    items: [
      { title: "الطلاب", href: "/admin/students", permission: "students", icon: "Users" },
      { title: "الشقق", href: "/admin/apartments", permission: "apartments", icon: "DoorOpen" },
    ],
  },
  {
    label: "المتابعة اليومية",
    items: [
      { title: "الحضور الجامعي", href: "/admin/attendance", permission: "attendance", icon: "ClipboardCheck" },
      { title: "الصلوات", href: "/admin/prayers", permission: "prayers", icon: "HandHeart" },
      { title: "الورد القرآني", href: "/admin/quran", permission: "quran", icon: "BookOpen" },
      { title: "السجل الصحي", href: "/admin/health", permission: "health", icon: "Stethoscope" },
    ],
  },
  {
    label: "الدعم والمتابعة",
    items: [
      { title: "الدعم الأكاديمي", href: "/admin/academic-support", permission: "academic", icon: "GraduationCap" },
      { title: "الشكاوى والمقترحات", href: "/admin/complaints", permission: "complaints", icon: "MessageSquareWarning" },
    ],
  },
  {
    label: "السكن والمرافق",
    items: [
      { title: "جدول النظافة", href: "/admin/cleaning", permission: "cleaning", icon: "SprayCan" },
      { title: "المرافق", href: "/admin/facilities", permission: "facilities", icon: "Building2" },
    ],
  },
  {
    label: "التحفيز والتقارير",
    items: [
      { title: "النقاط", href: "/admin/points", permission: "points", icon: "Trophy" },
      { title: "تنبيهات تستدعي الانتباه", href: "/admin/alerts", permission: "alerts", icon: "Siren" },
      { title: "الإشعارات", href: "/admin/notifications", permission: "notifications", icon: "BellRing" },
      { title: "التقارير", href: "/admin/reports", permission: "reports", icon: "FileBarChart" },
    ],
  },
];

export const studentNav: NavItem[] = [
  { title: "الرئيسية", href: "/app", icon: "LayoutDashboard" },
  { title: "الصلوات", href: "/app/prayers", icon: "HandHeart" },
  { title: "الورد القرآني", href: "/app/quran", icon: "BookOpen" },
  { title: "جدولي الجامعي", href: "/app/schedule", icon: "CalendarDays" },
  { title: "الحضور", href: "/app/attendance", icon: "ClipboardCheck" },
  { title: "مهامي", href: "/app/tasks", icon: "ListTodo" },
  { title: "الشكاوى والمقترحات", href: "/app/complaints", icon: "MessageSquareWarning" },
  { title: "الدعم الأكاديمي", href: "/app/academic-support", icon: "GraduationCap" },
  { title: "حالتي الصحية", href: "/app/health", icon: "Stethoscope" },
  { title: "النقاط", href: "/app/points", icon: "Trophy" },
  { title: "الإشعارات", href: "/app/notifications", icon: "BellRing" },
];

export const supervisorNavItem: NavItem = {
  title: "إدارة الشقة",
  href: "/app/apartment",
  icon: "Building2",
};

// الشريط السفلي في الجوال: أكثر الصفحات استخداماً يومياً بعناوين قصيرة
export const studentMobileNav: NavItem[] = [
  { title: "الرئيسية", href: "/app", icon: "LayoutDashboard" },
  { title: "الصلوات", href: "/app/prayers", icon: "HandHeart" },
  { title: "الورد", href: "/app/quran", icon: "BookOpen" },
  { title: "مهامي", href: "/app/tasks", icon: "ListTodo" },
];

export const adminMobileNav: NavItem[] = [
  { title: "الرئيسية", href: "/admin", icon: "LayoutDashboard" },
  { title: "الطلاب", href: "/admin/students", permission: "students", icon: "Users" },
  { title: "الحضور", href: "/admin/attendance", permission: "attendance", icon: "ClipboardCheck" },
  { title: "الشكاوى", href: "/admin/complaints", permission: "complaints", icon: "MessageSquareWarning" },
];

// تظهر للمدير العام فقط
export const teamNavGroup: NavGroup = {
  label: "الإدارة",
  items: [{ title: "الفريق والصلاحيات", href: "/admin/team", icon: "ShieldCheck" }],
};
