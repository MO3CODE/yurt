import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { AdhkarSession } from "@/components/adhkar/adhkar-session";
import { getSchedule } from "@/lib/prayer-times-server";
import { addDaysISO } from "@/lib/date";
import { adhkarDay, currentPeriod, type AdhkarPeriod } from "@/lib/adhkar";

export default async function AdhkarPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const schedule = await getSchedule(supabase);

  const now = new Date(schedule.nowIso);
  const day = adhkarDay(now, schedule.today, addDaysISO(schedule.today.day, -1));
  const { data: logs } = await supabase
    .from("adhkar_logs")
    .select("period")
    .eq("student_id", user.id)
    .eq("record_date", day);

  const done = new Set((logs ?? []).map((l) => l.period as AdhkarPeriod));

  return (
    <div className="stagger flex flex-col gap-6">
      <PageHeader title="الأذكار" description="أذكار الصباح والمساء من حصن المسلم" />
      <AdhkarSession
        day={day}
        initialPeriod={currentPeriod(now, schedule.today)}
        done={{ morning: done.has("morning"), evening: done.has("evening") }}
      />
    </div>
  );
}
