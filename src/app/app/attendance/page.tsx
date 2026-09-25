import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AttendanceToday } from "@/components/student/attendance-today";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { todayISO } from "@/lib/date";

const statusLabels: Record<string, string> = {
  present: "حاضر",
  late: "متأخر",
  excused: "غياب بعذر",
  absent: "غائب",
};

const statusVariant: Record<string, "secondary" | "outline" | "destructive"> = {
  present: "secondary",
  late: "outline",
  excused: "outline",
  absent: "destructive",
};

export default async function AttendancePage() {
  const user = await requireUser();
  const supabase = await createClient();
  const today = todayISO();

  const { data: records } = await supabase
    .from("attendance_records")
    .select("record_date, status, source")
    .eq("student_id", user.id)
    .order("record_date", { ascending: false })
    .limit(14);

  const todayRecord = records?.find((r) => r.record_date === today);
  const history = (records ?? []).filter((r) => r.record_date !== today);

  return (
    <div className="stagger flex flex-col gap-6">
      <PageHeader title="الحضور الجامعي" description="سجّل حضورك اليوم" />

      <Card>
        <CardHeader>
          <CardTitle>اليوم</CardTitle>
        </CardHeader>
        <CardContent>
          <AttendanceToday date={today} status={todayRecord?.status} locked={!!todayRecord && todayRecord.source !== "self"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>السجل السابق</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((r) => (
                <TableRow key={r.record_date}>
                  <TableCell className="font-medium">{r.record_date}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[r.status]}>{statusLabels[r.status]}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
