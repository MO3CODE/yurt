import { AppShell } from "@/components/nav/app-shell";
import { adminMobileNav, adminNav } from "@/components/nav/nav-config";
import { requireAdmin } from "@/lib/auth/current-user";

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
      user={{ fullName: user.fullName, avatarUrl: user.avatarUrl, roleLabel: roleLabels[user.role] ?? "إداري" }}
    >
      {children}
    </AppShell>
  );
}
