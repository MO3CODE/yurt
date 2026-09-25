import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { NotificationItem } from "@/components/student/notification-item";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { BellRing } from "lucide-react";

export default async function StudentNotificationsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: notifications }, { data: reads }] = await Promise.all([
    supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50),
    supabase.from("notification_reads").select("notification_id").eq("profile_id", user.id),
  ]);

  const readIds = new Set((reads ?? []).map((r) => r.notification_id));

  return (
    <div className="stagger flex flex-col gap-6">
      <PageHeader title="الإشعارات" description="كل الإشعارات الموجّهة لك" />

      {notifications && notifications.length > 0 ? (
        <div className="flex flex-col gap-3">
          {notifications.map((n) => (
            <NotificationItem
              key={n.id}
              id={n.id}
              title={n.title}
              body={n.body}
              createdAt={n.created_at}
              isRead={readIds.has(n.id)}
            />
          ))}
        </div>
      ) : (
        <Empty>
          <EmptyMedia variant="icon">
            <BellRing />
          </EmptyMedia>
          <EmptyTitle>لا توجد إشعارات</EmptyTitle>
          <EmptyDescription>ستصلك هنا كل الإشعارات من الإدارة</EmptyDescription>
        </Empty>
      )}
    </div>
  );
}
