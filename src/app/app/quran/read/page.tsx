import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";
import { MushafReader } from "@/components/quran/mushaf-reader";
import { clampPage } from "@/lib/quran";
import { todayISO } from "@/lib/date";

export default async function QuranReadPage({ searchParams }: PageProps<"/app/quran/read">) {
  const user = await requireUser();
  const supabase = await createClient();
  const { page } = await searchParams;

  const today = todayISO();
  const [{ data: progress }, { data: reads }, { data: log }] = await Promise.all([
    supabase.from("quran_progress").select("current_page, khatmas, daily_goal").eq("student_id", user.id).maybeSingle(),
    supabase.from("quran_page_reads").select("page").eq("student_id", user.id).eq("record_date", today),
    supabase.from("quran_wird_logs").select("pages").eq("student_id", user.id).eq("record_date", today).maybeSingle(),
  ]);

  const bookmark = progress?.current_page ?? 1;
  // بلا رقم صفحة في الرابط يفتح القارئ على العلامة
  const initialPage = typeof page === "string" ? clampPage(Number(page)) : bookmark;

  return (
    <MushafReader
      initialPage={initialPage}
      initialBookmark={bookmark}
      initialKhatmas={progress?.khatmas ?? 0}
      readToday={(reads ?? []).map((r) => r.page)}
      mushafPagesToday={Number(log?.pages ?? 0)}
      dailyGoal={progress?.daily_goal ?? null}
    />
  );
}
