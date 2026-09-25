import { AppShell } from "@/components/nav/app-shell";
import { studentMobileNav, studentNav, supervisorNavItem } from "@/components/nav/nav-config";
import { requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

// ما تكتبه الإدارة أو المشرف ويجب أن يظهر للطالب فوراً
const STUDENT_LIVE_TABLES = [
  "notifications",
  "points_entries",
  "complaints",
  "academic_support_requests",
  "attendance_records",
  "cleaning_assignments",
  "cleaning_tasks",
  "students",
];

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const items = user.supervisedApartmentId ? [...studentNav, supervisorNavItem] : studentNav;

  // عدد الإشعارات غير المقروءة لشارة الجرس
  const supabase = await createClient();
  const [{ data: notifications }, { data: reads }] = await Promise.all([
    supabase.from("notifications").select("id"),
    supabase.from("notification_reads").select("notification_id").eq("profile_id", user.id),
  ]);
  const readIds = new Set((reads ?? []).map((r) => r.notification_id));
  const unread = (notifications ?? []).filter((n) => !readIds.has(n.id)).length;

  return (
    <AppShell
      homeHref="/app"
      subtitle={user.apartmentName ?? "طالب"}
      groups={[{ label: "القائمة", items }]}
      mobileItems={studentMobileNav}
      notificationsHref="/app/notifications"
      unreadNotifications={unread}
      liveTables={STUDENT_LIVE_TABLES}
      user={{ fullName: user.fullName, avatarUrl: user.avatarUrl, roleLabel: user.supervisedApartmentId ? "طالب · مشرف شقة" : "طالب" }}
    >
      {children}
    </AppShell>
  );
}
