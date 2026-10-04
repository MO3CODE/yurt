import { requirePermission } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { AcademicTabs } from "@/components/academic/academic-tabs";

export default async function AcademicHubLayout({ children }: { children: React.ReactNode }) {
  await requirePermission("academic");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="الدعم والمتابعة"
        title="المتابعة الأكاديمية"
        description="درجات الطلاب وجلسات التقييم الفردية، والمواد المتعثَّر فيها، وتذكيرات واتساب، وخطتك ومتابعة ما أُنجز منها"
      />
      <AcademicTabs />
      {children}
    </div>
  );
}
