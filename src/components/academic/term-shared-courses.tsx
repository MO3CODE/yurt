import Link from "next/link";
import { Users } from "lucide-react";
import { arNum } from "@/lib/quran";

export type SharedCourse = { name: string; instructors: string[]; students: { id: string; name: string }[] };

/** مواد الترم التي يدرسها أكثر من طالب — من «مواد الترم» قبل ظهور أي درجة */
export function TermSharedCourses({ termName, shared, registered, total }: { termName: string; shared: SharedCourse[]; registered: number; total: number }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-lg font-semibold">المواد المشتركة في {termName}</h2>
        <span className="text-xs text-muted-foreground">
          سجّل موادَّه {arNum(registered)} من {arNum(total)} طالب
        </span>
      </div>
      {shared.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          لا مادة مشتركة بين طالبين بعد. يسجّل كل طالب مواده من «درجاتي»، أو تضيفها من ملفه الأكاديمي.
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {shared.map((c) => (
            <li key={c.name} className="flex flex-col gap-2 rounded-xl border p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold" dir="auto">
                  {c.name}
                </span>
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  <Users className="size-3.5" /> {arNum(c.students.length)}
                </span>
              </div>
              {c.instructors.length > 0 && (
                <span className="text-xs text-muted-foreground" dir="auto">
                  {c.instructors.join(" · ")}
                </span>
              )}
              <div className="flex flex-wrap gap-1.5">
                {c.students.map((s) => (
                  <Link key={s.id} href={`/admin/academic/${s.id}`} className="rounded-full bg-muted px-2.5 py-1 text-xs hover:bg-muted/70">
                    {s.name}
                  </Link>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
