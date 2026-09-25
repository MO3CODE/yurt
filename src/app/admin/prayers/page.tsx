import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { addDaysISO, todayISO } from "@/lib/date";

export default async function AdminPrayersPage() {
  const supabase = await createClient();
  const sinceISO = addDaysISO(todayISO(), -6);

  const [{ data: students }, { data: records }] = await Promise.all([
    supabase.from("students").select("id, profiles!students_id_fkey(full_name), apartment:apartment_id(name)").eq("status", "active"),
    supabase.from("prayer_records").select("student_id, status").gte("record_date", sinceISO),
  ]);

  const stats = new Map<string, { good: number; total: number }>();
  for (const r of records ?? []) {
    if (!stats.has(r.student_id)) stats.set(r.student_id, { good: 0, total: 0 });
    const s = stats.get(r.student_id)!;
    s.total += 1;
    if (r.status !== "missed") s.good += 1;
  }

  return (
    <div className="stagger flex flex-col gap-6">
      <PageHeader title="الصلوات" description="نسبة الالتزام بالصلاة آخر ٧ أيام (من ٣٥ صلاة)" />
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الطالب</TableHead>
                <TableHead>الشقة</TableHead>
                <TableHead>الالتزام</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(students ?? []).map((s) => {
                const fullName = (s.profiles as unknown as { full_name: string })?.full_name ?? "—";
                const apartment = s.apartment as unknown as { name: string } | null;
                const stat = stats.get(s.id);
                // من ٣٥ صلاة (٧ أيام × ٥) — الصلاة غير المسجّلة تُحسب غير مؤدّاة
                const pct = stat && stat.total > 0 ? Math.round((stat.good / 35) * 100) : null;
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{fullName}</TableCell>
                    <TableCell>{apartment?.name ?? "—"}</TableCell>
                    <TableCell>
                      {pct !== null ? (
                        <Badge variant={pct >= 80 ? "secondary" : pct >= 50 ? "outline" : "destructive"}>{pct}%</Badge>
                      ) : (
                        <span className="text-muted-foreground">لا يوجد تسجيل</span>
                      )}
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
