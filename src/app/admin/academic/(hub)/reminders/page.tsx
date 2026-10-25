import { requirePermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { ReminderComposer, type ComposerStudent } from "@/components/academic/reminder-composer";
import { COURSES_REMINDER_MARK, type ReminderKind } from "@/lib/academic";
import { termSortKey } from "@/lib/grades";
import { addDaysISO, dateISOInAppTz, todayISO } from "@/lib/date";

const KINDS: ReminderKind[] = ["session", "grades", "courses", "tutoring", "custom"];

export default async function AcademicRemindersPage({ searchParams }: PageProps<"/admin/academic/reminders">) {
  await requirePermission("academic");
  const sp = await searchParams;
  const supabase = await createClient();
  const today = todayISO();

  const { data: termRows } = await supabase.from("academic_terms").select("id, midterm_from, created_at").eq("historical", false);
  const currentTerm = (termRows ?? []).sort((a, b) => termSortKey(b).localeCompare(termSortKey(a)))[0];
  const [{ data: languageRows }, { data: termCourseRows }] = await Promise.all([
    supabase.from("student_language_progress").select("student_id, status"),
    currentTerm ? supabase.from("student_term_courses").select("student_id").eq("term_id", currentTerm.id) : Promise.resolve({ data: [] }),
  ]);
  // طالب اللغة = له متابعة لغة لم تكتمل؛ ومن سواه طالب جامعة
  const inLanguageYear = new Set((languageRows ?? []).filter((l) => l.status !== "completed").map((l) => l.student_id));
  const withCourses = new Set((termCourseRows ?? []).map((c) => c.student_id));

  const [{ data: students }, { data: profiles }, { data: links }, { data: subjects }, { data: reminders }] = await Promise.all([
    supabase.from("students").select("id, profiles!students_id_fkey(full_name, phone)").eq("status", "active"),
    supabase.from("student_academic_profiles").select("student_id, next_session_at, updated_at"),
    supabase.from("student_subjects").select("student_id, subject_id").eq("standing", "struggling"),
    supabase.from("academic_subjects").select("id, name"),
    supabase
      .from("academic_reminders")
      .select("student_id, kind, created_at, message")
      .gte("created_at", `${addDaysISO(today, -60)}T00:00:00Z`)
      .order("created_at", { ascending: false }),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.student_id, p]));
  const strugglingBy = new Map<string, string[]>();
  for (const l of links ?? []) strugglingBy.set(l.student_id, [...(strugglingBy.get(l.student_id) ?? []), l.subject_id]);

  const lastSentBy = new Map<string, ComposerStudent["lastSent"]>();
  for (const r of reminders ?? []) {
    const entry = lastSentBy.get(r.student_id) ?? {};
    const kind = (r.kind === "custom" && r.message.includes(COURSES_REMINDER_MARK) ? "courses" : r.kind) as ReminderKind;
    // مرتّبة من الأحدث، فأول ظهور هو الأحدث
    if (!entry[kind]) entry[kind] = dateISOInAppTz(r.created_at);
    lastSentBy.set(r.student_id, entry);
  }

  const composerStudents: ComposerStudent[] = (students ?? []).map((s) => {
    const person = s.profiles as unknown as { full_name: string; phone: string | null } | null;
    const p = profileById.get(s.id);
    return {
      id: s.id,
      name: person?.full_name ?? "—",
      phone: person?.phone ?? null,
      nextSession: p?.next_session_at ?? null,
      profileUpdatedDay: p ? dateISOInAppTz(p.updated_at) : null,
      struggling: strugglingBy.get(s.id) ?? [],
      lastSent: lastSentBy.get(s.id) ?? {},
      isUniversity: !inLanguageYear.has(s.id),
      hasTermCourses: withCourses.has(s.id),
    };
  });

  const activeIds = new Set(composerStudents.map((s) => s.id));
  const countBySubject = new Map<string, number>();
  for (const l of links ?? []) if (activeIds.has(l.student_id)) countBySubject.set(l.subject_id, (countBySubject.get(l.subject_id) ?? 0) + 1);
  const subjectOptions = (subjects ?? [])
    .map((s) => ({ id: s.id, name: s.name, count: countBySubject.get(s.id) ?? 0 }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ar"));

  const kindParam = typeof sp.kind === "string" ? sp.kind : "";
  const initialKind = (KINDS as string[]).includes(kindParam) ? (kindParam as ReminderKind) : "session";
  const subjectParam = typeof sp.subject === "string" && subjectOptions.some((s) => s.id === sp.subject) ? sp.subject : null;
  const studentParam = typeof sp.student === "string" && activeIds.has(sp.student) ? sp.student : null;

  return (
    <div className="stagger flex flex-col gap-4">
      <p className="max-w-3xl text-sm text-muted-foreground">
        تُجهَّز لكل طالب رسالة باسمه وموعده، وتضغط «واتساب» فتُفتح المحادثة جاهزة للإرسال. يسجّل النظام من أُرسل إليه حتى لا
        تكرر. (الإرسال الآلي دون ضغط يحتاج حساب WhatsApp Business API مدفوعاً.)
      </p>
      <ReminderComposer
        key={`${initialKind}-${subjectParam ?? ""}-${studentParam ?? ""}`}
        students={composerStudents}
        subjects={subjectOptions}
        today={today}
        initialKind={initialKind}
        initialSubject={subjectParam}
        initialStudent={studentParam}
      />
    </div>
  );
}
