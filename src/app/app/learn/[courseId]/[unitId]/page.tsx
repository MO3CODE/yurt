import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";
import { Button } from "@/components/ui/button";
import { UnitList } from "@/components/learning/unit-list";
import { UnitPlayer } from "@/components/learning/unit-player";
import { WritingUnit, type SubmissionView } from "@/components/learning/writing-unit";
import { ReadingUnit } from "@/components/learning/reading-unit";
import { VocabUnit } from "@/components/learning/vocab-unit";
import { readingGlossary, vocabCards } from "@/lib/learning/content";
import { WRITING_BUCKET, writingTopics, type WritingStatus } from "@/lib/learning/writing";
import { arNum } from "@/lib/quran";
import { UNIT_KIND_LABELS, formatDuration, type UnitKind } from "@/lib/learning";

export default async function UnitPage({ params }: PageProps<"/app/learn/[courseId]/[unitId]">) {
  const user = await requireUser();
  const { courseId, unitId } = await params;
  const supabase = await createClient();

  const [{ data: course }, { data: units }, { data: enrollment }, { data: progress }] = await Promise.all([
    supabase.from("courses").select("id, title").eq("id", courseId).maybeSingle(),
    supabase
      .from("course_units")
      .select("id, title, kind, duration_seconds, youtube_video_id, body, content")
      .eq("course_id", courseId)
      .order("position"),
    supabase.from("course_enrollments").select("course_id").eq("course_id", courseId).eq("student_id", user.id).maybeSingle(),
    supabase.from("course_unit_progress").select("unit_id").eq("course_id", courseId).eq("student_id", user.id),
  ]);
  if (!course || !units) notFound();
  // الإدارة تعاين بلا انضمام؛ الطالب يجب أن ينضم أولاً
  if (!enrollment && user.role === "student") redirect(`/app/learn/${courseId}`);

  const index = units.findIndex((u) => u.id === unitId);
  if (index === -1) notFound();
  const unit = units[index];
  const doneSet = new Set((progress ?? []).map((p) => p.unit_id));
  const href = (id: string) => `/app/learn/${courseId}/${id}`;
  const nextHref = index < units.length - 1 ? href(units[index + 1].id) : null;
  const prevHref = index > 0 ? href(units[index - 1].id) : null;

  // تسليمات الطالب في تدريب الكتابة، وصورها بروابط موقّعة لساعة من المخزن الخاص
  let submissions: SubmissionView[] = [];
  if (unit.kind === "writing") {
    const { data: rows } = await supabase
      .from("writing_submissions")
      .select("id, topic, status, feedback, note, created_at, image_paths")
      .eq("unit_id", unit.id)
      .eq("student_id", user.id)
      .order("created_at", { ascending: false });
    const paths = (rows ?? []).flatMap((r) => r.image_paths);
    const { data: signed } = paths.length
      ? await supabase.storage.from(WRITING_BUCKET).createSignedUrls(paths, 3600)
      : { data: [] as { path: string | null; signedUrl: string }[] };
    const urlBy = new Map((signed ?? []).map((x) => [x.path, x.signedUrl]));
    submissions = (rows ?? []).map((r) => ({
      id: r.id,
      topic: r.topic,
      status: r.status as WritingStatus,
      feedback: r.feedback,
      note: r.note,
      createdAt: r.created_at,
      images: r.image_paths.map((p) => urlBy.get(p)).filter((u): u is string => Boolean(u)),
    }));
  }

  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" size="sm" className="w-fit" nativeButton={false} render={<Link href={`/app/learn/${courseId}`} />}>
        <ArrowRight /> {course.title}
      </Button>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              {UNIT_KIND_LABELS[unit.kind as UnitKind]} {arNum(index + 1)} من {arNum(units.length)}
              {unit.duration_seconds ? ` · ${formatDuration(unit.duration_seconds)}` : ""}
            </span>
            <h1 className="font-heading text-xl font-semibold leading-snug break-words" dir="auto">
              {unit.title}
            </h1>
          </div>

          {unit.kind === "video" ? (
            <UnitPlayer
              key={unit.id}
              unitId={unit.id}
              courseId={courseId}
              videoId={unit.youtube_video_id}
              done={doneSet.has(unit.id)}
              nextHref={nextHref}
              prevHref={prevHref}
            />
          ) : unit.kind === "writing" ? (
            <WritingUnit
              key={unit.id}
              unitId={unit.id}
              userId={user.id}
              instructions={unit.body}
              topics={writingTopics(unit.content)}
              submissions={submissions}
            />
          ) : unit.kind === "reading" ? (
            <ReadingUnit
              key={unit.id}
              unitId={unit.id}
              courseId={courseId}
              body={unit.body ?? ""}
              glossary={readingGlossary(unit.content)}
              done={doneSet.has(unit.id)}
              nextHref={nextHref}
              prevHref={prevHref}
            />
          ) : (
            <VocabUnit
              key={unit.id}
              unitId={unit.id}
              courseId={courseId}
              cards={vocabCards(unit.content)}
              done={doneSet.has(unit.id)}
              nextHref={nextHref}
              prevHref={prevHref}
            />
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-2">
          <span className="text-sm font-medium">دروس الكورس</span>
          <UnitList
            units={units.map((u) => ({
              id: u.id,
              title: u.title,
              kind: u.kind as UnitKind,
              durationSeconds: u.duration_seconds,
              done: doneSet.has(u.id),
            }))}
            hrefFor={href}
            currentId={unit.id}
          />
        </aside>
      </div>
    </div>
  );
}
