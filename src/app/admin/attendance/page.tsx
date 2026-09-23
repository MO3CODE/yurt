import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { AttendanceStatus } from "@/lib/supabase/types";

const dotClass: Record<AttendanceStatus, string> = {
  present: "bg-success",
  late: "bg-warning",
  excused: "bg-primary",
  absent: "bg-destructive",
};

export default async function AdminAttendancePage() {
  const supabase = await createClient();

  const since = new Date();
  since.setDate(since.getDate() - 6);
  const sinceISO = since.toISOString().slice(0, 10);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  }).reverse();

  const [{ data: students }, { data: records }] = await Promise.all([
    supabase.from("students").select("id, profiles:id(full_name), apartment:apartment_id(name)").eq("status", "active"),
    supabase.from("attendance_records").select("student_id, record_date, status").gte("record_date", sinceISO),
  ]);

  const byStudent = new Map<string, Map<string, AttendanceStatus>>();
  for (const r of records ?? []) {
    if (!byStudent.has(r.student_id)) byStudent.set(r.student_id, new Map());
    byStudent.get(r.student_id)!.set(r.record_date, r.status);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="الحضور الجامعي" description="آخر ٧ أيام لكل الطلاب" />
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الطالب</TableHead>
                <TableHead>الشقة</TableHead>
                {days.map((d) => (
                  <TableHead key={d} className="text-center">
                    {d.slice(5)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(students ?? []).map((s) => {
                const fullName = (s.profiles as unknown as { full_name: string })?.full_name ?? "—";
                const apartment = s.apartment as unknown as { name: string } | null;
                const record = byStudent.get(s.id);
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{fullName}</TableCell>
                    <TableCell>{apartment?.name ?? "—"}</TableCell>
                    {days.map((d) => {
                      const status = record?.get(d);
                      return (
                        <TableCell key={d} className="text-center">
                          {status ? (
                            <span className={cn("inline-block size-2.5 rounded-full", dotClass[status])} />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
