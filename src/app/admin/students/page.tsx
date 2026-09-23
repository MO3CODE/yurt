import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { NewStudentDialog } from "@/components/admin/new-student-dialog";

const statusLabels: Record<string, string> = {
  active: "نشط",
  on_leave: "إجازة",
  graduated: "متخرج",
  withdrawn: "منسحب",
};

export default async function StudentsPage() {
  const supabase = await createClient();

  const [{ data: students }, { data: apartments }] = await Promise.all([
    supabase
      .from("students")
      .select("id, status, university_name, apartment:apartment_id(name), profiles:id(full_name)")
      .order("created_at", { ascending: false }),
    supabase.from("apartments").select("id, name").order("floor_number"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="الطلاب"
        description="كل طلاب السكن وبياناتهم"
        action={<NewStudentDialog apartments={apartments ?? []} trigger={<Button><Plus /> إضافة طالب</Button>} />}
      />

      <Card>
        <CardContent>
          {students && students.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الطالب</TableHead>
                  <TableHead>الشقة</TableHead>
                  <TableHead>الجامعة</TableHead>
                  <TableHead>الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s) => {
                  const fullName = (s.profiles as unknown as { full_name: string })?.full_name ?? "—";
                  const apartment = s.apartment as unknown as { name: string } | null;
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Link href={`/admin/students/${s.id}`} className="flex items-center gap-2 hover:underline">
                          <Avatar className="size-7">
                            <AvatarFallback className="bg-primary/10 text-xs text-primary">
                              {fullName.slice(0, 1)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{fullName}</span>
                        </Link>
                      </TableCell>
                      <TableCell>{apartment?.name ?? "—"}</TableCell>
                      <TableCell>{s.university_name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={s.status === "active" ? "secondary" : "outline"}>
                          {statusLabels[s.status]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <Empty>
              <EmptyMedia variant="icon">
                <Users />
              </EmptyMedia>
              <EmptyTitle>لا يوجد طلاب بعد</EmptyTitle>
              <EmptyDescription>أضف أول طالب لتبدأ المتابعة</EmptyDescription>
            </Empty>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
