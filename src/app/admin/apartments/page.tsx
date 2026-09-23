import Link from "next/link";
import { Plus, DoorOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { NewApartmentDialog } from "@/components/admin/new-apartment-dialog";

export default async function ApartmentsPage() {
  const supabase = await createClient();
  const { data: apartments } = await supabase
    .from("apartments")
    .select("id, name, floor_number, capacity, supervisor:supervisor_id(full_name), students(count)")
    .order("floor_number");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="الشقق"
        description="كل طابق شقة، ولها مشرف من الطلاب"
        action={<NewApartmentDialog trigger={<Button><Plus /> إضافة شقة</Button>} />}
      />

      <Card>
        <CardContent>
          {apartments && apartments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الشقة</TableHead>
                  <TableHead>الطابق</TableHead>
                  <TableHead>السعة</TableHead>
                  <TableHead>عدد الطلاب</TableHead>
                  <TableHead>المشرف</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apartments.map((apt) => {
                  const supervisor = apt.supervisor as unknown as { full_name: string } | null;
                  const studentsCount = (apt.students as unknown as { count: number }[])?.[0]?.count ?? 0;
                  return (
                    <TableRow key={apt.id}>
                      <TableCell className="font-medium">
                        <Link href={`/admin/apartments/${apt.id}`} className="hover:underline">
                          {apt.name}
                        </Link>
                      </TableCell>
                      <TableCell>{apt.floor_number}</TableCell>
                      <TableCell>{apt.capacity}</TableCell>
                      <TableCell>{studentsCount}</TableCell>
                      <TableCell>
                        {supervisor ? (
                          <Badge variant="secondary">{supervisor.full_name}</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">لا يوجد</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <Empty>
              <EmptyMedia variant="icon">
                <DoorOpen />
              </EmptyMedia>
              <EmptyTitle>لا توجد شقق بعد</EmptyTitle>
              <EmptyDescription>أضف أول شقة لتبدأ بتوزيع الطلاب عليها</EmptyDescription>
            </Empty>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
