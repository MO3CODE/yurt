import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/current-user";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GradeScaleEditor, ScholarshipSettingsForm } from "@/components/academic/scholarship-settings-form";
import { getScholarshipConfig } from "@/lib/scholarship-server";

export default async function AcademicSettingsPage() {
  await requirePermission("academic");
  const supabase = await createClient();
  const { settings, scales } = await getScholarshipConfig(supabase);

  return (
    <div className="flex flex-col gap-5">
      <ScholarshipSettingsForm initial={settings} />

      <Card>
        <CardHeader>
          <CardTitle>سلالم الدرجات</CardTitle>
          <CardDescription>
            سطر لكل رمز: الحرف ثم نقاطه، و«-» للرمز الذي لا يدخل في المعدل (انسحاب، ناجح بلا درجة…). سلّم كل طالب يُختار من ملفه الأكاديمي (التركي افتراضياً).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {scales.map((s) => (
            <GradeScaleEditor key={s.key} scale={s} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
