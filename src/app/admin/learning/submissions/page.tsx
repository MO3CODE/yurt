import Link from "next/link";
import { ArrowRight, PenLine } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ReviewCard, type ReviewItem } from "@/components/learning/admin/review-card";
import { cn } from "@/lib/utils";
import { arNum } from "@/lib/quran";
import { WRITING_BUCKET, type WritingStatus } from "@/lib/learning/writing";

export default async function SubmissionsPage({ searchParams }: PageProps<"/admin/learning/submissions">) {
  await requirePermission("learning");
  const { show } = await searchParams;
  const reviewed = show === "reviewed";
  const supabase = await createClient();

  const query = supabase
    .from("writing_submissions")
    .select("id, student_id, course_id, unit_id, topic, note, status, feedback, created_at, image_paths")
    .order("created_at", { ascending: !reviewed })
    .limit(60);
  const [{ data: rows }, { count: pendingCount }] = await Promise.all([
    reviewed ? query.neq("status", "pending") : query.eq("status", "pending"),
    supabase.from("writing_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  const list = rows ?? [];
  const [{ data: names }, { data: courses }, { data: units }, { data: signed }] = await Promise.all([
    list.length ? supabase.from("profiles").select("id, full_name").in("id", [...new Set(list.map((r) => r.student_id))]) : Promise.resolve({ data: [] }),
    list.length ? supabase.from("courses").select("id, title").in("id", [...new Set(list.map((r) => r.course_id))]) : Promise.resolve({ data: [] }),
    list.length ? supabase.from("course_units").select("id, title").in("id", [...new Set(list.map((r) => r.unit_id))]) : Promise.resolve({ data: [] }),
    list.length
      ? supabase.storage.from(WRITING_BUCKET).createSignedUrls(list.flatMap((r) => r.image_paths), 3600)
      : Promise.resolve({ data: [] as { path: string | null; signedUrl: string }[] }),
  ]);
  const nameBy = new Map((names ?? []).map((n: { id: string; full_name: string }) => [n.id, n.full_name]));
  const courseBy = new Map((courses ?? []).map((c: { id: string; title: string }) => [c.id, c.title]));
  const unitBy = new Map((units ?? []).map((u: { id: string; title: string }) => [u.id, u.title]));
  const urlBy = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  const items: ReviewItem[] = list.map((r) => ({
    id: r.id,
    studentName: nameBy.get(r.student_id) ?? "—",
    courseId: r.course_id,
    courseTitle: courseBy.get(r.course_id) ?? "—",
    unitTitle: unitBy.get(r.unit_id) ?? "—",
    topic: r.topic,
    note: r.note,
    status: r.status as WritingStatus,
    feedback: r.feedback,
    createdAt: r.created_at,
    images: r.image_paths.map((p) => urlBy.get(p)).filter((u): u is string => Boolean(u)),
  }));

  return (
    <div className="stagger flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" nativeButton={false} render={<Link href="/admin/learning" />}>
        <ArrowRight /> المنصة التعليمية
      </Button>
      <PageHeader title="تدريبات الكتابة" description="راجع كتابات الطلاب واكتب ملاحظاتك؛ يصلهم إشعار بالنتيجة" />

      <nav className="flex gap-2" aria-label="التصفية">
        {[
          { href: "/admin/learning/submissions", label: `بانتظار المراجعة${pendingCount ? ` (${arNum(pendingCount)})` : ""}`, active: !reviewed },
          { href: "/admin/learning/submissions?show=reviewed", label: "تمت مراجعتها", active: reviewed },
        ].map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              t.active ? "border-primary/40 bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {items.length > 0 ? (
        <div className="flex flex-col gap-4">
          {items.map((item) => (
            <ReviewCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <Empty>
          <EmptyMedia variant="icon">
            <PenLine />
          </EmptyMedia>
          <EmptyTitle>{reviewed ? "لا توجد تسليمات مراجَعة بعد" : "لا توجد كتابات بانتظار المراجعة"}</EmptyTitle>
          <EmptyDescription>تظهر هنا كتابات الطلاب فور رفعها من تدريبات الكتابة في الكورسات.</EmptyDescription>
        </Empty>
      )}
    </div>
  );
}
