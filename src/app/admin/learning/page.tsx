import Link from "next/link";
import { Library, MonitorPlay, PenLine, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CourseFormDialog } from "@/components/learning/admin/course-form-dialog";
import { LearningPointsSettings } from "@/components/learning/admin/learning-points-settings";
import { arNum } from "@/lib/quran";
import { CATEGORY_LABELS, formatDuration, type CourseCategory } from "@/lib/learning";

export default async function AdminLearningPage() {
  await requirePermission("learning");
  const supabase = await createClient();
  const [{ data: courses }, { data: points }, { count: pending }] = await Promise.all([
    supabase.from("course_catalog").select("*").order("created_at", { ascending: false }),
    supabase.from("learning_points_settings").select("course_complete, writing_approved").eq("id", 1).maybeSingle(),
    supabase.from("writing_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  return (
    <div className="stagger flex flex-col gap-6">
      <PageHeader
        title="المنصة التعليمية"
        description="الكورسات ودروسها ومتابعة المنضمين"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" nativeButton={false} render={<Link href="/admin/learning/library" />}>
              <Library /> مكتبة الكلمات
            </Button>
            <Button variant="outline" nativeButton={false} render={<Link href="/admin/learning/submissions" />}>
              <PenLine /> تدريبات الكتابة
              {pending ? <Badge className="bg-warning/25 text-warning-foreground dark:text-warning">{arNum(pending)}</Badge> : null}
            </Button>
            <CourseFormDialog
              trigger={
                <Button>
                  <Plus /> كورس جديد
                </Button>
              }
            />
          </div>
        }
      />

      <Card>
        <CardContent>
          {courses && courses.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الكورس</TableHead>
                  <TableHead>القسم</TableHead>
                  <TableHead>الدروس</TableHead>
                  <TableHead>المدة</TableHead>
                  <TableHead>المنضمون</TableHead>
                  <TableHead>الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <Link href={`/admin/learning/${c.id}`} className="hover:underline">
                        {c.title}
                      </Link>
                    </TableCell>
                    <TableCell>{CATEGORY_LABELS[c.category as CourseCategory]}</TableCell>
                    <TableCell className="tabular-nums">{arNum(c.units ?? 0)}</TableCell>
                    <TableCell>{formatDuration(c.total_seconds) || "—"}</TableCell>
                    <TableCell className="tabular-nums">{arNum(c.enrolled ?? 0)}</TableCell>
                    <TableCell>{c.published ? <Badge variant="secondary">منشور</Badge> : <Badge variant="outline">مسودة</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Empty>
              <EmptyMedia variant="icon">
                <MonitorPlay />
              </EmptyMedia>
              <EmptyTitle>لا توجد كورسات بعد</EmptyTitle>
              <EmptyDescription>أنشئ أول كورس ثم استورد دروسه من بلاي ليست يوتيوب.</EmptyDescription>
            </Empty>
          )}
        </CardContent>
      </Card>

      {points && (
        <Card>
          <CardHeader>
            <CardTitle>نقاط المنصة التعليمية</CardTitle>
            <CardDescription>تُمنح للطالب تلقائياً مرة واحدة لكل إنجاز (٠ يوقف البند)</CardDescription>
          </CardHeader>
          <CardContent>
            <LearningPointsSettings values={points} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
