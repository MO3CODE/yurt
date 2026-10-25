import { redirect } from "next/navigation";

// انتقل الدعم الأكاديمي إلى تبويب «الدعم» في المتابعة الأكاديمية
export default function AdminAcademicSupportPage() {
  redirect("/admin/academic/support");
}
