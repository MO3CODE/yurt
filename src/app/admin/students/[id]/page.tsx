import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditStudentForm } from "@/components/admin/edit-student-form";
import { ResetPasswordDialog } from "@/components/admin/reset-password-dialog";
import { CalendarX, MessageSquareWarning, Trophy, Stethoscope } from "lucide-react";

export default async function StudentDetailPage({ params }: PageProps<"/admin/students/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: profile }, { data: student }, { data: summary }, { data: apartments }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone").eq("id", id).single(),
    supabase.from("students").select("*").eq("id", id).single(),
    supabase.from("student_profile_summary").select("*").eq("student_id", id).single(),
    supabase.from("apartments").select("id, name").order("floor_number"),
  ]);

  if (!profile || !student) notFound();

  return (
    <div className="stagger flex flex-col gap-6">
      <PageHeader
        title={profile.full_name}
        description={profile.phone ?? undefined}
        action={<ResetPasswordDialog studentId={id} studentName={profile.full_name} />}
      />

      <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="أيام الغياب" value={summary?.total_absences ?? 0} icon={CalendarX} tone="warning" />
        <StatCard label="الشكاوى المقدَّمة" value={summary?.total_complaints ?? 0} icon={MessageSquareWarning} />
        <StatCard label="مجموع النقاط" value={summary?.total_points ?? 0} icon={Trophy} tone="success" />
        <StatCard label="حالات صحية مستمرة" value={summary?.ongoing_health_issues ?? 0} icon={Stethoscope} tone="destructive" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>بيانات الطالب</CardTitle>
        </CardHeader>
        <CardContent>
          <EditStudentForm
            studentId={id}
            apartments={apartments ?? []}
            defaults={{
              apartment_id: student.apartment_id,
              university_name: student.university_name,
              major: student.major,
              academic_year: student.academic_year,
              status: student.status,
              emergency_contact_name: student.emergency_contact_name,
              emergency_contact_phone: student.emergency_contact_phone,
              notes: student.notes,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
