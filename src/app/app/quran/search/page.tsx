import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { QuranLibrary } from "@/components/quran/quran-library";

export default async function QuranSearchPage({ searchParams }: PageProps<"/app/quran/search">) {
  const user = await requireUser();
  const supabase = await createClient();
  const { tab } = await searchParams;
  const { data: bookmarks } = await supabase
    .from("quran_bookmarks")
    .select("id, surah, aya, page, note, created_at")
    .eq("student_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="stagger flex flex-col gap-6">
      <PageHeader title="البحث والعلامات" description="ابحث بكلمة في القرآن، وارجع إلى الآيات التي حفظتها" />
      <QuranLibrary bookmarks={bookmarks ?? []} initialTab={tab === "bookmarks" ? "bookmarks" : "search"} />
    </div>
  );
}
