import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";

const categoryLabels: Record<string, string> = {
  prayer: "الصلاة",
  quran: "الورد القرآني",
  attendance: "الحضور",
  cleaning: "النظافة",
  academic: "أكاديمي",
  other: "أخرى",
};

export default async function StudentPointsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  // السجل يعرض آخر ٣٠ فقط، أما المجموع فمن كل الإدخالات (ليطابق لوحة الطالب)
  const [{ data: entries }, { data: allPoints }] = await Promise.all([
    supabase
      .from("points_entries")
      .select("*")
      .eq("student_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("points_entries").select("points").eq("student_id", user.id),
  ]);

  const total = (allPoints ?? []).reduce((sum, e) => sum + e.points, 0);

  return (
    <div className="stagger flex flex-col gap-6">
      <PageHeader title="نقاطي" description="نقاطك مقابل التزامك اليومي" />

      <StatCard label="مجموع النقاط" value={total} icon={Trophy} tone="success" />

      <Card>
        <CardHeader>
          <CardTitle>السجل</CardTitle>
        </CardHeader>
        <CardContent>
          {entries && entries.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {entries.map((e) => (
                <li key={e.id} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                  <span>
                    {categoryLabels[e.category]} {e.reason && `— ${e.reason}`}
                  </span>
                  <span className={e.points >= 0 ? "text-success font-medium" : "text-destructive font-medium"}>
                    {e.points >= 0 ? `+${e.points}` : e.points}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">لا توجد نقاط بعد</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
