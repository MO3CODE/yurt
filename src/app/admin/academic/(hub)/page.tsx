import Link from "next/link";
import { CalendarClock, FileSpreadsheet, GraduationCap, TrendingDown, Users } from "lucide-react";
import { requirePermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/stat-card";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ImportDialog } from "@/components/academic/import-dialog";
import { StudentsBoard, type BoardStudent } from "@/components/academic/students-board";
import { gpaRatio, gpaTone } from "@/lib/academic";
import { daysBetweenISO, formatShortDateISO, todayISO } from "@/lib/date";

export default async function AcademicOverviewPage() {
  await requirePermission("academic");
  const supabase = await createClient();
  const today = todayISO();

  const [{ data: students }, { data: profiles }, { data: links }, { data: subjects }] = await Promise.all([
    supabase
      .from("students")
      .select("id, university_name, major, academic_year, profiles!students_id_fkey(full_name)")
      .eq("status", "active"),
    supabase.from("student_academic_profiles").select("student_id, gpa, gpa_scale, next_session_at"),
    supabase.from("student_subjects").select("student_id, subject_id, standing"),
    supabase.from("academic_subjects").select("id, name"),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.student_id, p]));
  const subjectName = new Map((subjects ?? []).map((s) => [s.id, s.name]));
  const subjectsByStudent = new Map<string, { strong: string[]; struggling: string[] }>();
  for (const l of links ?? []) {
    const entry = subjectsByStudent.get(l.student_id) ?? { strong: [], struggling: [] };
    const name = subjectName.get(l.subject_id);
    if (name) entry[l.standing].push(name);
    subjectsByStudent.set(l.student_id, entry);
  }

  const rows: BoardStudent[] = (students ?? [])
    .map((s) => {
      const p = profileById.get(s.id);
      const subj = subjectsByStudent.get(s.id) ?? { strong: [], struggling: [] };
      const scale = p?.gpa_scale ?? 4;
      const next = p?.next_session_at ?? null;
      return {
        id: s.id,
        name: (s.profiles as unknown as { full_name: string } | null)?.full_name ?? "—",
        meta: [s.university_name, s.major, s.academic_year].filter(Boolean).join(" · "),
        tracked: !!p && (p.gpa !== null || subj.strong.length + subj.struggling.length > 0),
        gpa: p?.gpa ?? null,
        scale,
        tone: gpaTone(p?.gpa, scale),
        daysToSession: next ? daysBetweenISO(today, next) : null,
        nextSessionLabel: next ? formatShortDateISO(next) : null,
        strong: subj.strong,
        struggling: subj.struggling,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));

  const tracked = rows.filter((r) => r.tracked);
  const ratios = tracked.map((r) => gpaRatio(r.gpa, r.scale)).filter((r): r is number => r !== null);
  const avg = ratios.length ? (ratios.reduce((a, b) => a + b, 0) / ratios.length) * 4 : null;
  const needAttention = rows.filter((r) => r.tone === "risk" || r.struggling.length >= 3).length;
  const sessionsDue = rows.filter((r) => r.daysToSession !== null && r.daysToSession <= 7).length;

  if (rows.length === 0) {
    return (
      <Empty>
        <EmptyMedia variant="icon">
          <Users />
        </EmptyMedia>
        <EmptyTitle>لا يوجد طلاب نشطون بعد</EmptyTitle>
        <EmptyDescription>
          أضف الطلاب من{" "}
          <Link href="/admin/students" className="underline underline-offset-4">
            صفحة الطلاب
          </Link>{" "}
          ثم عُد لإدخال بياناتهم الأكاديمية
        </EmptyDescription>
      </Empty>
    );
  }

  return (
    <div className="stagger flex flex-col gap-6">
      <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={`ملفات مُدخلة من ${rows.length}`} value={tracked.length} icon={Users} />
        <StatCard
          label="متوسط المعدل"
          value={avg === null ? "—" : `${avg.toFixed(2)} / 4`}
          icon={GraduationCap}
          tone="success"
          hint={ratios.length ? `من ${ratios.length} طالب` : undefined}
        />
        <StatCard label="يحتاجون اهتماماً" value={needAttention} icon={TrendingDown} tone="destructive" hint="معدل منخفض أو ٣ مواد متعثرة فأكثر" />
        <StatCard label="جلسات قريبة أو متأخرة" value={sessionsDue} icon={CalendarClock} tone="warning" hint="خلال ٧ أيام" />
      </div>

      {tracked.length === 0 && (
        <section className="flex flex-col gap-3 rounded-2xl border border-primary/25 bg-primary/[0.04] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileSpreadsheet className="size-5" />
            </span>
            <div className="flex flex-col gap-1">
              <span className="font-heading text-base font-semibold">ابدأ بإدخال بيانات الطلاب دفعة واحدة</span>
              <span className="max-w-xl text-sm text-muted-foreground">
                جهّز جدولاً (اسم الطالب، المعدل، المواد القوية، المواد المتعثرة) والصقه هنا، فتُملأ ملفات كل الطلاب مرة واحدة.
                بعدها تحدّث كل طالب في جلساته الفردية.
              </span>
            </div>
          </div>
          <ImportDialog students={rows.map((r) => ({ id: r.id, name: r.name }))} />
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-semibold">ملفات الطلاب</h2>
        {tracked.length > 0 && <ImportDialog students={rows.map((r) => ({ id: r.id, name: r.name }))} />}
      </div>
      <StudentsBoard students={rows} />
    </div>
  );
}
