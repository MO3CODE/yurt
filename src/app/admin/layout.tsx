import { AppShell } from "@/components/nav/app-shell";
import { adminMobileNav, adminNav } from "@/components/nav/nav-config";
import { requireAdmin } from "@/lib/auth/current-user";

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

const roleLabels: Record<string, string> = {
  super_admin: "مدير عام",
  admin: "إداري",
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();

  return (
    <AppShell
      homeHref="/admin"
      subtitle="لوحة الإدارة"
      groups={adminNav}
      mobileItems={adminMobileNav}
      notificationsHref="/admin/notifications"
      searchStudents
      liveTables={ADMIN_LIVE_TABLES}
      user={{ fullName: user.fullName, avatarUrl: user.avatarUrl, roleLabel: roleLabels[user.role] ?? "إداري" }}
    >
      {children}
    </AppShell>
  );
}
