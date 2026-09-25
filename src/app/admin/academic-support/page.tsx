import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { AcademicSupportCard } from "@/components/admin/academic-support-card";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { GraduationCap } from "lucide-react";
import { requirePermission } from "@/lib/auth/current-user";

export default async function AdminAcademicSupportPage() {
  await requirePermission("academic");
  const supabase = await createClient();
  const { data: requests } = await supabase
    .from("academic_support_requests")
    .select("*, student:student_id(profiles!students_id_fkey(full_name))")
    .order("created_at", { ascending: false });

  return (
    <div className="stagger flex flex-col gap-6">
      <PageHeader title="الدعم الأكاديمي" description="متابعة طلبات التقوية الدراسية" />

      {requests && requests.length > 0 ? (
        <div className="flex flex-col gap-3">
          {requests.map((r) => {
            const student = r.student as unknown as { profiles: { full_name: string } } | null;
            return <AcademicSupportCard key={r.id} request={r} studentName={student?.profiles?.full_name ?? "—"} />;
          })}
        </div>
      ) : (
        <Empty>
          <EmptyMedia variant="icon">
            <GraduationCap />
          </EmptyMedia>
          <EmptyTitle>لا توجد طلبات دعم أكاديمي</EmptyTitle>
          <EmptyDescription>ستظهر هنا طلبات التقوية فور تقديمها</EmptyDescription>
        </Empty>
      )}
    </div>
  );
}
