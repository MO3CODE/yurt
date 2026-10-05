import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { VocabLibrary } from "@/components/learning/admin/vocab-library";
import { VOCAB_PACKS } from "@/lib/learning/vocab-packs";

export default async function VocabLibraryPage() {
  await requirePermission("learning");
  const supabase = await createClient();
  const { data: courses } = await supabase.from("courses").select("id, title").order("created_at", { ascending: false });

  return (
    <div className="stagger flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" nativeButton={false} render={<Link href="/admin/learning" />}>
        <ArrowRight /> المنصة التعليمية
      </Button>
      <PageHeader
        title="مكتبة الكلمات الجاهزة"
        description="٣٠٠ كلمة إنجليزية بثلاثة مستويات: المعنى بالعربي وجملة ونطق. أنشئ منها كورساً، أو اختر مواضيع وأضفها لكورس موجود، ثم عدّل ما تشاء."
      />
      <VocabLibrary packs={VOCAB_PACKS} courses={courses ?? []} />
    </div>
  );
}
