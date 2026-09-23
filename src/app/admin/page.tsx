import Link from "next/link";
import { Users, DoorOpen, MessageSquareWarning, Siren } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { ApartmentHealthTable } from "@/components/admin/apartment-health-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { LayoutDashboard } from "lucide-react";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [{ count: studentsCount }, { count: apartmentsCount }, { count: openComplaints }, { count: unresolvedAlerts }, { data: health }] =
    await Promise.all([
      supabase.from("students").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("apartments").select("*", { count: "exact", head: true }),
      supabase.from("complaints").select("*", { count: "exact", head: true }).not("status", "in", "(resolved,rejected)"),
      supabase.from("alerts").select("*", { count: "exact", head: true }).eq("resolved", false),
      supabase.from("apartment_health").select("*").order("overall_score", { ascending: true }),
    ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="لوحة التحكم" description="نظرة سريعة على حالة السكن اليوم" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="الطلاب النشطون" value={studentsCount ?? 0} icon={Users} />
        <StatCard label="الشقق" value={apartmentsCount ?? 0} icon={DoorOpen} tone="success" />
        <StatCard label="شكاوى مفتوحة" value={openComplaints ?? 0} icon={MessageSquareWarning} tone="warning" />
        <StatCard label="تنبيهات غير محلولة" value={unresolvedAlerts ?? 0} icon={Siren} tone="destructive" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>لوحة صحة السكن</CardTitle>
        </CardHeader>
        <CardContent>
          {health && health.length > 0 ? (
            <ApartmentHealthTable rows={health} />
          ) : (
            <Empty>
              <EmptyMedia variant="icon">
                <LayoutDashboard />
              </EmptyMedia>
              <EmptyTitle>لا توجد شقق بعد</EmptyTitle>
              <EmptyDescription>
                ابدأ بإضافة الشقق والطلاب من{" "}
                <Link href="/admin/apartments" className="underline underline-offset-4">
                  صفحة الشقق
                </Link>
              </EmptyDescription>
            </Empty>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
