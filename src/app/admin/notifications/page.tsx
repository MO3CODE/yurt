import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { NewNotificationDialog } from "@/components/admin/new-notification-dialog";
import { BellRing } from "lucide-react";
import { requirePermission } from "@/lib/auth/current-user";

const targetLabels: Record<string, string> = {
  all: "كل الطلاب",
  apartment: "شقة",
  student: "طالب",
  role: "فئة إدارية",
};

export default async function AdminNotificationsPage() {
  await requirePermission("notifications");
  const supabase = await createClient();

  const [{ data: notifications }, { data: apartments }, { data: students }] = await Promise.all([
    supabase
      .from("notifications")
      .select("*, apartment:target_apartment_id(name), student:target_student_id(profiles!students_id_fkey(full_name))")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("apartments").select("id, name").order("floor_number"),
    supabase.from("students").select("id, profiles!students_id_fkey(full_name)"),
  ]);

  const studentOptions = (students ?? []).map((s) => ({
    id: s.id,
    full_name: (s.profiles as unknown as { full_name: string })?.full_name ?? "—",
  }));

  return (
    <div className="stagger flex flex-col gap-6">
      <PageHeader
        title="الإشعارات"
        description="أرسل إشعاراً لكل الطلاب أو لشقة أو طالب معين"
        action={<NewNotificationDialog apartments={apartments ?? []} students={studentOptions} />}
      />

      {notifications && notifications.length > 0 ? (
        <div className="flex flex-col gap-3">
          {notifications.map((n) => {
            const apartment = n.apartment as unknown as { name: string } | null;
            const student = n.student as unknown as { profiles: { full_name: string } } | null;
            return (
              <Card key={n.id}>
                <CardContent className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{n.title}</span>
                    <Badge variant="secondary">
                      {targetLabels[n.target_type]}
                      {apartment && ` · ${apartment.name}`}
                      {student && ` · ${student.profiles?.full_name}`}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{n.body}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Empty>
          <EmptyMedia variant="icon">
            <BellRing />
          </EmptyMedia>
          <EmptyTitle>لا توجد إشعارات مرسلة بعد</EmptyTitle>
          <EmptyDescription>أرسل أول إشعار لتنبيه الطلاب بشيء مهم</EmptyDescription>
        </Empty>
      )}
    </div>
  );
}
