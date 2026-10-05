import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarClock, MessageCircle, TrendingDown, TrendingUp } from "lucide-react";
import { requirePermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { ProgressRing } from "@/components/progress-ring";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SessionDialog } from "@/components/academic/session-dialog";
import { GpaTrend } from "@/components/academic/gpa-trend";
import { StudentGradeHistory } from "@/components/grades/student-grade-history";
import { getStudentGrades } from "@/lib/grades-server";
import { GPA_TONE_CLASSES, REMINDER_KINDS, formatGpa, gpaRatio, gpaTone } from "@/lib/academic";
import { daysBetweenISO, formatLongDateISO, formatShortDateISO, todayISO } from "@/lib/date";
import { cn } from "@/lib/utils";

export default async function AcademicStudentPage({ params }: PageProps<"/admin/academic/[id]">) {
  await requirePermission("academic");
  const { id } = await params;
  const supabase = await createClient();
  const today = todayISO();

  const [{ data: student }, { data: profile }, { data: links }, { data: sessions }, { data: reminders }, { data: catalog }] =
    await Promise.all([
      supabase
        .from("students")
        .select("id, university_name, major, academic_year, profiles!students_id_fkey(full_name, phone)")
        .eq("id", id)
        .maybeSingle(),
      supabase.from("student_academic_profiles").select("*").eq("student_id", id).maybeSingle(),
      supabase.from("student_subjects").select("subject_id, standing, grade").eq("student_id", id),
      supabase
        .from("assessment_sessions")
        .select("*")
        .eq("student_id", id)
        .order("session_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.from("academic_reminders").select("kind, created_at").eq("student_id", id).order("created_at", { ascending: false }).limit(4),
      supabase.from("academic_subjects").select("id, name").order("name"),
    ]);

  if (!student) notFound();

  // كشوف الدرجات التي رفعها الطالب (بالملفات بروابط موقّعة)
  const grades = await getStudentGrades(supabase, id);

  const person = student.profiles as unknown as { full_name: string; phone: string | null } | null;
  const name = person?.full_name ?? "—";
  const nameBySubject = new Map((catalog ?? []).map((s) => [s.id, s.name]));
  const subjects = (links ?? [])
    .map((l) => ({ name: nameBySubject.get(l.subject_id) ?? "—", standing: l.standing, grade: l.grade }))
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));
  const struggling = subjects.filter((s) => s.standing === "struggling");
  const strong = subjects.filter((s) => s.standing === "strong");

  const scale = profile?.gpa_scale ?? 4;
  const gpa = profile?.gpa ?? null;
  const tone = GPA_TONE_CLASSES[gpaTone(gpa, scale)];
  const ratio = gpaRatio(gpa, scale);
  const nextSession = profile?.next_session_at ?? null;
  const nextDays = nextSession ? daysBetweenISO(today, nextSession) : null;

  // تغيّر المعدل مقارنةً بأقرب جلسة أقدم لها معدل بالمقياس نفسه
  const list = sessions ?? [];
  const withDelta = list.map((s, i) => {
    const prev = list.slice(i + 1).find((p) => p.gpa !== null && p.gpa_scale === s.gpa_scale);
    return { ...s, delta: s.gpa !== null && prev?.gpa != null ? Number((s.gpa - prev.gpa).toFixed(2)) : null };
  });
  const trend = [...list]
    .reverse()
    .filter((s) => s.gpa !== null)
    .map((s) => ({
      label: formatShortDateISO(s.session_date),
      ratio: gpaRatio(s.gpa, s.gpa_scale) ?? 0,
      text: formatGpa(s.gpa, s.gpa_scale),
    }));

  const meta = [student.university_name, student.major, student.academic_year].filter(Boolean).join(" · ");
  const dialogProps = {
    studentId: id,
    studentName: name,
    today,
    gpa,
    gpaScale: scale,
    nextSession,
    subjects,
    catalog: (catalog ?? []).map((c) => c.name),
  };

  return (
    <div className="stagger flex flex-col gap-6">
      <Link href="/admin/academic" className="flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowRight className="size-4" /> المتابعة الأكاديمية
      </Link>

      <PageHeader
        eyebrow="ملف أكاديمي"
        title={name}
        description={meta || undefined}
        action={
          <>
            <SessionDialog {...dialogProps} mode="edit" />
            <SessionDialog {...dialogProps} mode="session" />
          </>
        }
      />

      <div className="@container">
      <div className="grid gap-5 @3xl:grid-cols-3">
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>المعدل</CardTitle>
              <CardDescription>{profile?.last_session_at ? `آخر جلسة: ${formatShortDateISO(profile.last_session_at)}` : "لم تُسجَّل جلسة بعد"}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <ProgressRing value={ratio ?? 0} max={1} size={84} stroke={8} className={tone.text}>
                  <span className={cn("font-heading text-lg font-semibold tabular-nums", tone.text)} dir="ltr">
                    {gpa === null ? "—" : scale >= 100 ? gpa.toFixed(0) : gpa.toFixed(2)}
                  </span>
                </ProgressRing>
                <div className="flex flex-col leading-tight">
                  <span className="text-sm text-muted-foreground" dir="ltr">
                    {formatGpa(gpa, scale)}
                  </span>
                  <span className={cn("font-medium", tone.text)}>{tone.label}</span>
                </div>
              </div>
              <GpaTrend points={trend} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>الجلسة القادمة</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {nextSession && nextDays !== null ? (
                <>
                  <div className="flex items-center gap-2">
                    <CalendarClock className="size-5 text-primary" />
                    <span className="font-medium">{formatLongDateISO(nextSession)}</span>
                  </div>
                  <span
                    className={cn(
                      "w-fit rounded-full px-2.5 py-1 text-xs font-medium",
                      nextDays < 0 ? "bg-destructive/10 text-destructive" : nextDays <= 7 ? "bg-warning/18 text-warning-foreground dark:text-warning" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {nextDays < 0 ? `متأخرة ${-nextDays} يوم` : nextDays === 0 ? "اليوم" : `بعد ${nextDays} يوم`}
                  </span>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">لم يُحدَّد موعد — حدّده من «جلسة تقييم جديدة».</p>
              )}
              {person?.phone && (
                <Button variant="outline" size="sm" className="w-fit" nativeButton={false} render={<Link href={`/admin/academic/reminders?kind=session&student=${id}`} />}>
                  <MessageCircle /> تذكير عبر واتساب
                </Button>
              )}
              {(reminders ?? []).length > 0 && (
                <ul className="flex flex-col gap-1 border-t pt-3 text-xs text-muted-foreground">
                  {(reminders ?? []).map((r) => (
                    <li key={r.created_at} className="flex justify-between gap-2">
                      <span>{REMINDER_KINDS.find((k) => k.kind === r.kind)?.label ?? r.kind}</span>
                      <span>{formatShortDateISO(r.created_at.slice(0, 10))}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>المواد</CardTitle>
              <CardDescription>
                {struggling.length} متعثر · {strong.length} قوي
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {subjects.length === 0 && <p className="text-sm text-muted-foreground">لم تُسجَّل مواد بعد.</p>}
              {struggling.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-destructive">متعثر فيها</span>
                  <div className="flex flex-wrap gap-1.5">
                    {struggling.map((s) => (
                      <span key={s.name} className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs text-destructive">
                        {s.name}
                        {s.grade !== null && <span className="ms-1 opacity-70 tabular-nums">· {s.grade}</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {strong.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-success">قوي فيها</span>
                  <div className="flex flex-wrap gap-1.5">
                    {strong.map((s) => (
                      <span key={s.name} className="rounded-full bg-success/12 px-2.5 py-1 text-xs text-success">
                        {s.name}
                        {s.grade !== null && <span className="ms-1 opacity-70 tabular-nums">· {s.grade}</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <StudentGradeHistory terms={grades.terms} reports={grades.reports} urlBy={grades.urlBy} />
        </div>

        <Card className="@3xl:col-span-2">
          <CardHeader>
            <CardTitle>سجل الجلسات</CardTitle>
            <CardDescription>{list.length > 0 ? `${list.length} جلسة` : "ستظهر هنا جلسات التقييم الفردية بتاريخها وملخصها"}</CardDescription>
          </CardHeader>
          <CardContent>
            {withDelta.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">لا توجد جلسات بعد — ابدأ بـ «جلسة تقييم جديدة».</p>
            ) : (
              <ol className="relative flex flex-col gap-5 border-s-2 border-dashed border-border ps-6">
                {withDelta.map((s) => (
                  <li key={s.id} className="relative flex flex-col gap-2">
                    <span className="absolute top-1.5 -start-[1.95rem] size-3 rotate-45 rounded-[3px] border-2 border-card bg-primary" aria-hidden />
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-semibold">{formatLongDateISO(s.session_date)}</span>
                      {s.gpa !== null && (
                        <span className="text-sm text-muted-foreground tabular-nums" dir="ltr">
                          {formatGpa(s.gpa, s.gpa_scale)}
                        </span>
                      )}
                      {s.delta !== null && s.delta !== 0 && (
                        <span
                          className={cn(
                            "flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium",
                            s.delta > 0 ? "bg-success/12 text-success" : "bg-destructive/10 text-destructive"
                          )}
                        >
                          {s.delta > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                          <span dir="ltr">{s.delta > 0 ? `+${s.delta}` : s.delta}</span>
                        </span>
                      )}
                    </div>
                    {s.summary && <p className="text-sm leading-relaxed whitespace-pre-line">{s.summary}</p>}
                    {s.action_items && (
                      <ul className="flex flex-col gap-1 rounded-xl bg-muted/50 p-3 text-sm">
                        {s.action_items
                          .split("\n")
                          .map((l) => l.trim())
                          .filter(Boolean)
                          .map((l, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="mt-2 size-1 shrink-0 rounded-full bg-primary" aria-hidden />
                              {l}
                            </li>
                          ))}
                      </ul>
                    )}
                    {s.next_session_date && (
                      <span className="text-xs text-muted-foreground">الجلسة التالية: {formatShortDateISO(s.next_session_date)}</span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}
