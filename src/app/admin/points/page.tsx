import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AwardPointsDialog } from "@/components/admin/award-points-dialog";
import { Trophy } from "lucide-react";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { monthStartISO } from "@/lib/date";

export default async function AdminPointsPage() {
  const supabase = await createClient();
  const monthStart = monthStartISO();

  const [{ data: leaderboard }, { data: students }] = await Promise.all([
    supabase
      .from("points_leaderboard")
      .select("*")
      .eq("month", monthStart)
      .order("total_points", { ascending: false }),
    supabase.from("students").select("id, profiles!students_id_fkey(full_name)"),
  ]);

  const studentOptions = (students ?? []).map((s) => ({
    id: s.id,
    full_name: (s.profiles as unknown as { full_name: string })?.full_name ?? "—",
  }));

  return (
    <div className="stagger flex flex-col gap-6">
      <PageHeader title="النقاط والتحفيز" description="لوحة الشرف الشهرية" action={<AwardPointsDialog students={studentOptions} />} />

      <Card>
        <CardContent>
          {leaderboard && leaderboard.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الترتيب</TableHead>
                  <TableHead>الطالب</TableHead>
                  <TableHead>مجموع النقاط</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((row, i) => (
                  <TableRow key={row.student_id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell className="font-medium">{row.full_name}</TableCell>
                    <TableCell>{row.total_points}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Empty>
              <EmptyMedia variant="icon">
                <Trophy />
              </EmptyMedia>
              <EmptyTitle>لا توجد نقاط هذا الشهر بعد</EmptyTitle>
              <EmptyDescription>ابدأ بمنح نقاط للطلاب المميزين</EmptyDescription>
            </Empty>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
