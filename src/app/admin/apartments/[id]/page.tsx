import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SupervisorSelect } from "@/components/admin/supervisor-select";

export default async function ApartmentDetailPage({ params }: PageProps<"/admin/apartments/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: apartment } = await supabase.from("apartments").select("*").eq("id", id).single();
  if (!apartment) notFound();

  const { data: students } = await supabase
    .from("students")
    .select("id, university_name, status, profiles:id(full_name)")
    .eq("apartment_id", id);

  const studentOptions = (students ?? []).map((s) => ({
    id: s.id,
    full_name: (s.profiles as unknown as { full_name: string })?.full_name ?? "—",
  }));

  const { data: complaints } = await supabase
    .from("complaints")
    .select("id, subject, status, created_at")
    .eq("apartment_id", id)
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={apartment.name} description={`طابق ${apartment.floor_number} — السعة ${apartment.capacity} طلاب`} />

      <Card>
        <CardHeader>
          <CardTitle>مشرف الشقة</CardTitle>
        </CardHeader>
        <CardContent>
          <SupervisorSelect
            apartmentId={apartment.id}
            currentSupervisorId={apartment.supervisor_id}
            students={studentOptions}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>الطلاب ({studentOptions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>الجامعة</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(students ?? []).map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    <Link href={`/admin/students/${s.id}`} className="hover:underline">
                      {(s.profiles as unknown as { full_name: string })?.full_name}
                    </Link>
                    {s.id === apartment.supervisor_id && (
                      <Badge variant="outline" className="ms-2">
                        مشرف
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{s.university_name ?? "—"}</TableCell>
                  <TableCell>{s.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>آخر الشكاوى والمقترحات</CardTitle>
        </CardHeader>
        <CardContent>
          {complaints && complaints.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {complaints.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-sm">
                  <span>{c.subject}</span>
                  <Badge variant="secondary">{c.status}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">لا توجد شكاوى مسجّلة</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
