import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { addDaysISO, todayISO } from "@/lib/date";

export default async function AdminQuranPage() {
  const supabase = await createClient();
  const today = todayISO();
  const sinceISO = addDaysISO(today, -6);

  const [{ data: students }, { data: logs }] = await Promise.all([
    supabase.from("students").select("id, profiles!students_id_fkey(full_name), apartment:apartment_id(name)").eq("status", "active"),
    supabase.from("quran_wird_logs").select("student_id, record_date, pages").gte("record_date", sinceISO),
  ]);

  const stats = new Map<string, { days: Set<string>; pages: number }>();
  for (const l of logs ?? []) {
    if (!stats.has(l.student_id)) stats.set(l.student_id, { days: new Set(), pages: 0 });
    const s = stats.get(l.student_id)!;
    s.days.add(l.record_date);
    s.pages += Number(l.pages ?? 0);
  }

  return (
    <div className="stagger flex flex-col gap-6">
      <PageHeader title="الورد القرآني" description="نشاط آخر ٧ أيام" />
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الطالب</TableHead>
                <TableHead>الشقة</TableHead>
                <TableHead>أيام السجل (من ٧)</TableHead>
                <TableHead>مجموع الصفحات</TableHead>
                <TableHead>اليوم</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(students ?? []).map((s) => {
                const fullName = (s.profiles as unknown as { full_name: string })?.full_name ?? "—";
                const apartment = s.apartment as unknown as { name: string } | null;
                const stat = stats.get(s.id);
                const loggedToday = stat?.days.has(today) ?? false;
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{fullName}</TableCell>
                    <TableCell>{apartment?.name ?? "—"}</TableCell>
                    <TableCell>{stat?.days.size ?? 0}</TableCell>
                    <TableCell>{stat?.pages ?? 0}</TableCell>
                    <TableCell>
                      {loggedToday ? <Badge variant="secondary">سجّل</Badge> : <Badge variant="outline">لم يسجّل</Badge>}
                    </TableCell>
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
