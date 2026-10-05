import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { WirdSourceBadge } from "@/components/quran/wird-source-badge";
import { addDaysISO, todayISO } from "@/lib/date";
import { requirePermission } from "@/lib/auth/current-user";
import { QURAN_PAGES, arNum, wirdSource } from "@/lib/quran";

export default async function AdminQuranPage() {
  await requirePermission("quran");
  const supabase = await createClient();
  const today = todayISO();
  const sinceISO = addDaysISO(today, -6);

  const [{ data: students }, { data: logs }, { data: reads }, { data: progress }, { data: adhkar }] = await Promise.all([
    supabase.from("students").select("id, profiles!students_id_fkey(full_name), apartment:apartment_id(name)").eq("status", "active"),
    supabase.from("quran_wird_logs").select("student_id, record_date, pages").gte("record_date", sinceISO),
    supabase.from("quran_platform_daily").select("student_id, record_date, pages").gte("record_date", sinceISO),
    supabase.from("quran_progress").select("student_id, current_page, khatmas, daily_goal"),
    supabase.from("adhkar_logs").select("student_id, period").gte("record_date", sinceISO),
  ]);

  // عدد أيام إتمام أذكار الصباح والمساء خلال الأسبوع
  const adhkarBy = new Map<string, { morning: number; evening: number }>();
  for (const a of adhkar ?? []) {
    const row = adhkarBy.get(a.student_id) ?? { morning: 0, evening: 0 };
    if (a.period === "morning") row.morning++;
    else row.evening++;
    adhkarBy.set(a.student_id, row);
  }

  type Stat = { days: Set<string>; mushafPages: number; platformPages: number; mushafDays: number };
  const stats = new Map<string, Stat>();
  const statFor = (id: string) => {
    if (!stats.has(id)) stats.set(id, { days: new Set(), mushafPages: 0, platformPages: 0, mushafDays: 0 });
    return stats.get(id)!;
  };
  for (const l of logs ?? []) {
    const s = statFor(l.student_id);
    s.days.add(l.record_date);
    s.mushafPages += Number(l.pages ?? 0);
    s.mushafDays += 1;
  }
  for (const r of reads ?? []) {
    if (!r.student_id || !r.record_date) continue;
    const s = statFor(r.student_id);
    s.days.add(r.record_date);
    s.platformPages += r.pages ?? 0;
  }
  const progressBy = new Map((progress ?? []).map((p) => [p.student_id, p]));

  return (
    <div className="stagger flex flex-col gap-6">
      <PageHeader title="الورد والأذكار" description="نشاط آخر ٧ أيام" />
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الطالب</TableHead>
                <TableHead>الشقة</TableHead>
                <TableHead>أيام السجل (من ٧)</TableHead>
                <TableHead>مجموع الصفحات</TableHead>
                <TableHead>المصدر</TableHead>
                <TableHead>الختمة</TableHead>
                <TableHead>الورد اليومي</TableHead>
                <TableHead>أذكار الصباح</TableHead>
                <TableHead>أذكار المساء</TableHead>
                <TableHead>اليوم</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(students ?? []).map((s) => {
                const fullName = (s.profiles as unknown as { full_name: string })?.full_name ?? "—";
                const apartment = s.apartment as unknown as { name: string } | null;
                const stat = stats.get(s.id);
                const source = stat ? wirdSource(stat.platformPages, stat.mushafDays > 0) : null;
                const prog = progressBy.get(s.id);
                const loggedToday = stat?.days.has(today) ?? false;
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{fullName}</TableCell>
                    <TableCell>{apartment?.name ?? "—"}</TableCell>
                    <TableCell>{stat?.days.size ?? 0}</TableCell>
                    <TableCell>{(stat?.mushafPages ?? 0) + (stat?.platformPages ?? 0)}</TableCell>
                    <TableCell>{source ? <WirdSourceBadge source={source} /> : "—"}</TableCell>
                    <TableCell className="tabular-nums">
                      {prog ? (
                        <>
                          {arNum(prog.current_page - 1)} / {arNum(QURAN_PAGES)}
                          {prog.khatmas > 0 && ` · ${arNum(prog.khatmas)} ختمة`}
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{prog?.daily_goal ? `${arNum(prog.daily_goal)} ص` : "—"}</TableCell>
                    <TableCell className="tabular-nums">{arNum(adhkarBy.get(s.id)?.morning ?? 0)} / ٧</TableCell>
                    <TableCell className="tabular-nums">{arNum(adhkarBy.get(s.id)?.evening ?? 0)} / ٧</TableCell>
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
