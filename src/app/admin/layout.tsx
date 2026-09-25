import { AppShell } from "@/components/nav/app-shell";
import { adminMobileNav, adminNav, teamNavGroup, type NavItem } from "@/components/nav/nav-config";
import { hasPermission, requireAdmin } from "@/lib/auth/current-user";
import { ROLE_LABELS } from "@/lib/auth/permissions";

// ما يكتبه الطلاب والمشرفون ويجب أن يظهر للإدارة فوراً
const ADMIN_LIVE_TABLES = [
  "prayer_records",
  "attendance_records",
  "quran_wird_logs",
  "complaints",
  "academic_support_requests",
  "health_records",
  "facility_issues",
  "cleaning_assignments",
  "alerts",
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  // كل إداري يرى الأقسام المسموحة له فقط
  const allowed = (item: NavItem) => !item.permission || hasPermission(user, item.permission);
  const groups = [...adminNav, ...(user.isSuperAdmin ? [teamNavGroup] : [])]
    .map((g) => ({ ...g, items: g.items.filter(allowed) }))
    .filter((g) => g.items.length > 0);

  return (
    <AppShell
      homeHref="/admin"
      subtitle="لوحة الإدارة"
      groups={groups}
      mobileItems={adminMobileNav.filter(allowed)}
      notificationsHref="/admin/notifications"
      searchStudents={hasPermission(user, "students")}
      liveTables={ADMIN_LIVE_TABLES}
      user={{ fullName: user.fullName, avatarUrl: user.avatarUrl, roleLabel: ROLE_LABELS[user.role] ?? "إداري" }}
    >
      {children}
    </AppShell>
  );
}
