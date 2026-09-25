import Link from "next/link";
import {
  Users,
  DoorOpen,
  MessageSquareWarning,
  Siren,
  UserPlus,
  Send,
  FileBarChart,
  LayoutDashboard,
  ClipboardCheck,
  HandHeart,
  ShieldAlert,
} from "lucide-react";
import { isPermissionKey, permissionLabel } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/current-user";
import { StatCard } from "@/components/stat-card";
import { HeroPanel } from "@/components/hero-panel";
import { ProgressRing } from "@/components/progress-ring";
import { ApartmentHealthTable } from "@/components/admin/apartment-health-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { greeting, hijriDate, longDate, todayISO } from "@/lib/date";

export default async function AdminDashboardPage({ searchParams }: PageProps<"/admin">) {
  const user = await requireAdmin();
  const { denied } = await searchParams;
  const deniedLabel = typeof denied === "string" && isPermissionKey(denied) ? permissionLabel(denied) : null;
  const supabase = await createClient();
  const today = todayISO();

  const [
    { count: studentsCount },
    { count: apartmentsCount },
    { count: openComplaints },
    { count: unresolvedAlerts },
    { data: health },
    { data: attendanceToday },
    { data: prayersToday },
  ] = await Promise.all([
    supabase.from("students").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("apartments").select("*", { count: "exact", head: true }),
    supabase.from("complaints").select("*", { count: "exact", head: true }).not("status", "in", "(resolved,rejected)"),
    supabase.from("alerts").select("*", { count: "exact", head: true }).eq("resolved", false),
    supabase.from("apartment_health").select("*").order("overall_score", { ascending: true }),
    supabase.from("attendance_records").select("status").eq("record_date", today),
    supabase.from("prayer_records").select("status").eq("record_date", today),
  ]);

  const active = studentsCount ?? 0;
  const attendanceLogged = attendanceToday?.length ?? 0;
  const present = (attendanceToday ?? []).filter((a) => a.status === "present" || a.status === "late").length;
  const prayersDone = (prayersToday ?? []).filter((p) => p.status === "mosque" || p.status === "prayed").length;
  const inMosque = (prayersToday ?? []).filter((p) => p.status === "mosque").length;
  const prayerTarget = active * 5;

  return (
    <div className="stagger flex flex-col gap-6">
      {deniedLabel && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
          <ShieldAlert className="size-4 shrink-0 text-warning-foreground dark:text-warning" />
          ليست لديك صلاحية الوصول إلى قسم «{deniedLabel}». تواصل مع المدير العام إن كنت تحتاجها.
        </div>
      )}
      <HeroPanel>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3">
            <span className="flex items-center gap-2 text-xs font-medium text-sidebar-primary">
              <span className="size-1.5 rotate-45 bg-sidebar-primary" aria-hidden />
              {hijriDate()} · {longDate()}
            </span>
            <h1 className="font-heading text-3xl font-semibold text-sidebar-accent-foreground md:text-4xl">
              {greeting()}، {user.fullName.split(" ")[0]}
            </h1>
            <p className="max-w-lg text-sm text-sidebar-foreground/70">
              {(unresolvedAlerts ?? 0) > 0
                ? `هناك ${unresolvedAlerts} تنبيه بانتظار المتابعة اليوم.`
                : "لا توجد تنبيهات عاجلة — السكن بحالة جيدة اليوم."}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                size="sm"
                className="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/85"
                nativeButton={false}
                render={<Link href="/admin/students" />}
              >
                <UserPlus /> إضافة طالب
              </Button>
              {[
                { href: "/admin/notifications", label: "إرسال إشعار", icon: Send },
                { href: "/admin/reports", label: "التقارير", icon: FileBarChart },
              ].map((a) => (
                <Button
                  key={a.href}
                  size="sm"
                  variant="ghost"
                  className="bg-sidebar-accent/60 text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  nativeButton={false}
                  render={<Link href={a.href} />}
                >
                  <a.icon /> {a.label}
                </Button>
              ))}
            </div>
          </div>

          {/* نبض اليوم */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {[
              { label: "حضور الجامعة", icon: ClipboardCheck, value: present, max: active, sub: `${attendanceLogged} سجّلوا` },
              { label: "الصلوات المؤدّاة", icon: HandHeart, value: prayersDone, max: prayerTarget, sub: `${inMosque} في المسجد` },
            ].map((m) => (
              <div key={m.label} className="flex items-center gap-3 rounded-2xl bg-sidebar-accent/50 p-3 ring-1 ring-sidebar-border sm:p-4">
                <ProgressRing value={m.value} max={m.max} size={64} stroke={6} className="text-sidebar-primary" trackClassName="text-sidebar-accent">
                  <m.icon className="size-5 text-sidebar-accent-foreground" />
                </ProgressRing>
                <div className="flex flex-col leading-tight">
                  <span className="font-heading text-xl font-semibold text-sidebar-accent-foreground tabular-nums">
                    {m.value}
                    <span className="text-sm text-sidebar-foreground/50">/{m.max}</span>
                  </span>
                  <span className="text-xs text-sidebar-foreground/70">{m.label}</span>
                  <span className="text-[0.7rem] text-sidebar-foreground/50">{m.sub}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </HeroPanel>

      <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="الطلاب النشطون" value={active} icon={Users} href="/admin/students" />
        <StatCard label="الشقق" value={apartmentsCount ?? 0} icon={DoorOpen} tone="gold" href="/admin/apartments" />
        <StatCard label="شكاوى مفتوحة" value={openComplaints ?? 0} icon={MessageSquareWarning} tone="warning" href="/admin/complaints" />
        <StatCard label="تنبيهات غير محلولة" value={unresolvedAlerts ?? 0} icon={Siren} tone="destructive" href="/admin/alerts" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>صحة الشقق</CardTitle>
          <CardDescription>مرتبة من الأكثر حاجة للمتابعة — اضغط على شقة لتفاصيلها</CardDescription>
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
