import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { ComplaintCard } from "@/components/admin/complaint-card";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { MessageSquareWarning } from "lucide-react";
import { updateComplaint } from "./actions";
import { requirePermission } from "@/lib/auth/current-user";

export default async function AdminComplaintsPage() {
  await requirePermission("complaints");
  const supabase = await createClient();

  const { data: complaints } = await supabase
    .from("complaints")
    .select("*, student:student_id(profiles!students_id_fkey(full_name)), apartment:apartment_id(name)")
    .order("created_at", { ascending: false });

  return (
    <div className="stagger flex flex-col gap-6">
      <PageHeader title="الشكاوى والمقترحات" description="متابعة كل شكاوى ومقترحات الطلاب" />

      {complaints && complaints.length > 0 ? (
        <div className="flex flex-col gap-3">
          {complaints.map((c) => {
            const student = c.student as unknown as { profiles: { full_name: string } } | null;
            const apartment = c.apartment as unknown as { name: string } | null;
            return (
              <ComplaintCard
                key={c.id}
                complaint={c}
                studentName={student?.profiles?.full_name ?? "—"}
                apartmentName={apartment?.name}
                statusOptions={["new", "triaged", "in_progress", "escalated", "resolved", "rejected"]}
                responseFieldName="admin_response"
                onSave={updateComplaint}
              />
            );
          })}
        </div>
      ) : (
        <Empty>
          <EmptyMedia variant="icon">
            <MessageSquareWarning />
          </EmptyMedia>
          <EmptyTitle>لا توجد شكاوى بعد</EmptyTitle>
          <EmptyDescription>ستظهر هنا شكاوى ومقترحات الطلاب فور تقديمها</EmptyDescription>
        </Empty>
      )}
    </div>
  );
}
