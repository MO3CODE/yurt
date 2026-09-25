import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WirdForm } from "@/components/student/wird-form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { todayISO } from "@/lib/date";

export default async function QuranPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const today = todayISO();

  const { data: logs } = await supabase
    .from("quran_wird_logs")
    .select("*")
    .eq("student_id", user.id)
    .order("record_date", { ascending: false })
    .limit(14);

  const todayLog = logs?.find((l) => l.record_date === today) ?? null;
  const history = (logs ?? []).filter((l) => l.record_date !== today);

  return (
    <div className="stagger flex flex-col gap-6">
      <PageHeader title="الورد القرآني" description="سجّل وردك اليومي من القرآن" />

      <Card>
        <CardHeader>
          <CardTitle>ورد اليوم</CardTitle>
        </CardHeader>
        <CardContent>
          <WirdForm
            date={today}
            defaults={{
              range_description: todayLog?.range_description ?? "",
              pages: todayLog?.pages ?? undefined,
              memorization: todayLog?.memorization ?? false,
              note: todayLog?.note ?? "",
            }}
          />
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
                <TableHead>الورد</TableHead>
                <TableHead>الصفحات</TableHead>
                <TableHead>حفظ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.record_date}</TableCell>
                  <TableCell>{l.range_description ?? "—"}</TableCell>
                  <TableCell>{l.pages ?? "—"}</TableCell>
                  <TableCell>{l.memorization ? <Badge variant="secondary">نعم</Badge> : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
