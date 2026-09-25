import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PrintButton } from "@/components/admin/print-button";
import { todayISO } from "@/lib/date";
import { requirePermission } from "@/lib/auth/current-user";

const statusLabels: Record<string, string> = {
  active: "نشط",
  on_leave: "إجازة",
  graduated: "متخرج",
  withdrawn: "منسحب",
};

export default async function ReportsPage() {
  await requirePermission("reports");
  const supabase = await createClient();

  const { data: summary } = await supabase
    .from("student_profile_summary")
    .select("*")
    .order("apartment_name")
    .order("full_name");

  return (
    <div className="stagger flex flex-col gap-6">
      <PageHeader
        title="التقارير"
        description="تقرير شامل لكل الطلاب — جاهز للطباعة أو التصدير كـ PDF لتقديمه للجهة المانحة"
        action={<PrintButton />}
      />

      <Card>
        <CardHeader>
          <CardTitle>تقرير عام — {todayISO()}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الطالب</TableHead>
                <TableHead>الشقة</TableHead>
                <TableHead>الجامعة</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>أيام الغياب</TableHead>
                <TableHead>الشكاوى</TableHead>
                <TableHead>النقاط</TableHead>
                <TableHead>حالات صحية مستمرة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(summary ?? []).map((row) => (
                <TableRow key={row.student_id}>
                  <TableCell className="font-medium">{row.full_name}</TableCell>
                  <TableCell>{row.apartment_name ?? "—"}</TableCell>
                  <TableCell>{row.university_name ?? "—"}</TableCell>
                  <TableCell>{row.status ? statusLabels[row.status] : "—"}</TableCell>
                  <TableCell>{row.total_absences}</TableCell>
                  <TableCell>{row.total_complaints}</TableCell>
                  <TableCell>{row.total_points}</TableCell>
                  <TableCell>{row.ongoing_health_issues}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
