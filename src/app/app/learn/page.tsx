import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { CourseCard } from "@/components/learning/course-card";
import { ScheduleBadge } from "@/components/learning/schedule-badge";
import { cn } from "@/lib/utils";
import { todayISO } from "@/lib/date";
import { COURSE_CATEGORIES, isCategory, type CourseCategory, type CourseLevel } from "@/lib/learning";
import { getMyCourses } from "@/lib/learning/server";

export default async function LearnPage({ searchParams }: PageProps<"/app/learn">) {
  const user = await requireUser();
  const supabase = await createClient();
  const { cat } = await searchParams;
  const category = isCategory(cat) ? cat : null;
  const today = todayISO();

  const [mine, { data: catalog }] = await Promise.all([
    getMyCourses(supabase, user.id, today),
    supabase.from("course_catalog").select("*").eq("published", true).order("created_at", { ascending: false }),
  ]);
  const enrolledIds = new Set(mine.map((c) => c.id));
  const available = (catalog ?? []).filter((c) => c.id && !enrolledIds.has(c.id) && (!category || c.category === category) && (c.units ?? 0) > 0);

  const toCard = (c: NonNullable<typeof catalog>[number]) => ({
    id: c.id!,
    title: c.title ?? "",
    category: c.category as CourseCategory,
    level: (c.level as CourseLevel | null) ?? null,
    coverUrl: c.cover_url,
    units: c.units ?? 0,
    totalSeconds: c.total_seconds ?? 0,
  });
  const catalogById = new Map((catalog ?? []).map((c) => [c.id, c]));

  return (
    <div className="stagger flex flex-col gap-8">
      <PageHeader title="المنصة التعليمية" description="كورسات مختارة: انضم، حدّد موعد إنهائك، وتابع دروسك يوماً بيوم" />

      {mine.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-semibold">كورساتي</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mine.map((c) => {
              const row = catalogById.get(c.id);
              return (
                <CourseCard
                  key={c.id}
                  href={`/app/learn/${c.id}`}
                  course={row ? toCard(row) : { id: c.id, title: c.title, category: c.category, level: null, coverUrl: c.coverUrl, units: c.units.length, totalSeconds: 0 }}
                  progress={{ done: c.done, total: c.units.length }}
                  badge={<ScheduleBadge state={c.schedule.state} behind={c.schedule.behind} />}
                />
              );
            })}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">{mine.length > 0 ? "كورسات أخرى" : "الكورسات"}</h2>
        <nav className="flex flex-wrap gap-2" aria-label="الأقسام">
          <CategoryChip href="/app/learn" active={!category} label="الكل" />
          {COURSE_CATEGORIES.map((c) => (
            <CategoryChip key={c.key} href={`/app/learn?cat=${c.key}`} active={category === c.key} label={c.label} />
          ))}
        </nav>
        {available.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {available.map((c) => (
              <CourseCard key={c.id} href={`/app/learn/${c.id}`} course={toCard(c)} />
            ))}
          </div>
        ) : (
          <Empty>
            <EmptyMedia variant="icon">
              <GraduationCap />
            </EmptyMedia>
            <EmptyTitle>{category ? "لا توجد كورسات في هذا القسم بعد" : "لا توجد كورسات جديدة بعد"}</EmptyTitle>
            <EmptyDescription>تضيف الإدارة الكورسات تباعاً، تابعنا.</EmptyDescription>
          </Empty>
        )}
      </section>
    </div>
  );
}

function CategoryChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors",
        active ? "border-primary/40 bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </Link>
  );
}
