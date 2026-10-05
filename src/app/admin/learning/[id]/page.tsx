import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CourseFormDialog } from "@/components/learning/admin/course-form-dialog";
import { CourseAdminActions } from "@/components/learning/admin/course-admin-actions";
import { UnitsManager } from "@/components/learning/admin/units-manager";
import { ScheduleBadge } from "@/components/learning/schedule-badge";
import { formatShortDateISO, todayISO } from "@/lib/date";
import { arNum } from "@/lib/quran";
import { CATEGORY_LABELS, courseSchedule, formatDuration, unitsLabel, type CourseCategory, type UnitKind } from "@/lib/learning";
import { writingTopics } from "@/lib/learning/writing";

export default async function AdminCoursePage({ params }: PageProps<"/admin/learning/[id]">) {
  await requirePermission("learning");
  const { id } = await params;
  const supabase = await createClient();
  const today = todayISO();

  const [{ data: course }, { data: units }, { data: enrollments }] = await Promise.all([
    supabase.from("courses").select("*").eq("id", id).maybeSingle(),
    supabase.from("course_units").select("id, title, kind, duration_seconds, body, content").eq("course_id", id).order("position"),
    supabase.from("course_enrollment_progress").select("*").eq("course_id", id),
  ]);
  if (!course) notFound();

  const studentIds = (enrollments ?? []).map((e) => e.student_id).filter((x): x is string => Boolean(x));
  const { data: names } = studentIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", studentIds)
    : { data: [] as { id: string; full_name: string }[] };
  const nameBy = new Map((names ?? []).map((n) => [n.id, n.full_name]));

  const total = units?.length ?? 0;
  const totalSeconds = (units ?? []).reduce((s, u) => s + (u.duration_seconds ?? 0), 0);
  const rows = (enrollments ?? [])
    .map((e) => ({
      ...e,
      name: nameBy.get(e.student_id ?? "") ?? "—",
      schedule: courseSchedule({ total, done: e.done ?? 0, startedOn: e.started_on!, targetDate: e.target_date!, today }),
    }))
    .sort((a, b) => (b.done ?? 0) - (a.done ?? 0));

  return (
    <div className="stagger flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" nativeButton={false} render={<Link href="/admin/learning" />}>
        <ArrowRight /> المنصة التعليمية
      </Button>

      <PageHeader
        title={course.title}
        description={`${CATEGORY_LABELS[course.category as CourseCategory]} · ${unitsLabel(total)}${totalSeconds ? ` · ${formatDuration(totalSeconds)}` : ""}`}
        action={
          <CourseFormDialog
            courseId={course.id}
            defaults={{ title: course.title, category: course.category, level: course.level, description: course.description }}
            trigger={
              <Button variant="outline">
                <Pencil /> تعديل البيانات
              </Button>
            }
          />
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        {course.published ? <Badge variant="secondary">منشور</Badge> : <Badge variant="outline">مسودة: لا يراه الطلاب</Badge>}
        <CourseAdminActions courseId={course.id} published={course.published} title={course.title} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>الدروس</CardTitle>
          <CardDescription>رتّبها كما تريد أن يتابعها الطالب</CardDescription>
        </CardHeader>
        <CardContent>
          <UnitsManager
            courseId={course.id}
            units={(units ?? []).map((u) => ({
              id: u.id,
              title: u.title,
              kind: u.kind as UnitKind,
              durationSeconds: u.duration_seconds,
              body: u.body,
              topics: writingTopics(u.content),
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>المنضمون</CardTitle>
          <CardDescription>{rows.length ? `${arNum(rows.length)} طالب` : "لم ينضم أحد بعد"}</CardDescription>
        </CardHeader>
        {rows.length > 0 && (
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الطالب</TableHead>
                  <TableHead>الإنجاز</TableHead>
                  <TableHead>الموعد</TableHead>
                  <TableHead>الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.student_id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="min-w-36">
                      <div className="flex items-center gap-2">
                        <Progress value={total ? ((r.done ?? 0) / total) * 100 : 0} className="flex-1" aria-label="الإنجاز" />
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {arNum(r.done ?? 0)}/{arNum(total)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{formatShortDateISO(r.target_date!)}</TableCell>
                    <TableCell>
                      <ScheduleBadge state={r.completed_at ? "completed" : r.schedule.state} behind={r.schedule.behind} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
