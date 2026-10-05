import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";
import { MushafReader } from "@/components/quran/mushaf-reader";
import { clampPage } from "@/lib/quran";
import { todayISO } from "@/lib/date";

export default async function QuranReadPage({ searchParams }: PageProps<"/app/quran/read">) {
  const user = await requireUser();
  const supabase = await createClient();
  const { page, aya } = await searchParams;

  const today = todayISO();
  const [{ data: progress }, { data: reads }, { data: log }, { data: bookmarks }] = await Promise.all([
    supabase.from("quran_progress").select("current_page, khatmas, daily_goal").eq("student_id", user.id).maybeSingle(),
    supabase.from("quran_page_reads").select("page").eq("student_id", user.id).eq("record_date", today),
    supabase.from("quran_wird_logs").select("pages").eq("student_id", user.id).eq("record_date", today).maybeSingle(),
    supabase.from("quran_bookmarks").select("surah, aya").eq("student_id", user.id),
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
      initialAya={typeof aya === "string" && /^\d{1,3}:\d{1,3}$/.test(aya) ? aya : null}
      bookmarkedKeys={(bookmarks ?? []).map((b) => `${b.surah}:${b.aya}`)}
    />
  );
}
