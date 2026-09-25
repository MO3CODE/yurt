import { Crown, DoorOpen, ShieldCheck, UsersRound, ClipboardCheck, MessageSquareWarning, SprayCan } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NewStaffDialog } from "@/components/admin/team/new-staff-dialog";
import { StaffActions } from "@/components/admin/team/staff-actions";
import { SupervisorSelect } from "@/components/admin/supervisor-select";
import { ALL_PERMISSIONS, isPermissionKey, permissionLabel, type PermissionKey } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/date";
import { cn } from "@/lib/utils";

export const metadata = { title: "الفريق والصلاحيات" };

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
}

export default async function TeamPage() {
  const me = await requireSuperAdmin();
  const admin = createAdminClient();
  const supabase = await createClient();

  const [{ data: staffProfiles }, { data: authList }, { data: apartments }, { data: students }] = await Promise.all([
    admin.from("profiles").select("*").in("role", ["admin", "super_admin"]).order("created_at"),
    admin.auth.admin.listUsers({ perPage: 1000 }),
    supabase.from("apartments").select("id, name, floor_number, supervisor_id").order("floor_number"),
    supabase.from("students").select("id, apartment_id, profiles!students_id_fkey(full_name)").eq("status", "active"),
  ]);

  const authById = new Map((authList?.users ?? []).map((u) => [u.id, u]));
  const staff = (staffProfiles ?? []).map((p) => {
    const auth = authById.get(p.id);
    const stored = (p as { permissions?: string[] | null }).permissions;
    const permissions: PermissionKey[] =
      p.role === "super_admin" || stored === undefined ? ALL_PERMISSIONS : (stored ?? []).filter(isPermissionKey);
    return {
      id: p.id,
      fullName: p.full_name,
      phone: p.phone,
      role: p.role as "admin" | "super_admin",
      permissions,
      email: auth?.email ?? "—",
      lastSignIn: auth?.last_sign_in_at ?? null,
      suspended: !!auth?.banned_until && new Date(auth.banned_until) > new Date(),
    };
  });
  // المدير العام أولاً، ثم أنت، ثم البقية
  staff.sort((a, b) => Number(b.role === "super_admin") - Number(a.role === "super_admin") || Number(b.id === me.id) - Number(a.id === me.id));

  const studentsByApartment = new Map<string, { id: string; full_name: string }[]>();
  const nameById = new Map<string, string>();
  for (const s of students ?? []) {
    const name = (s.profiles as unknown as { full_name: string } | null)?.full_name ?? "—";
    nameById.set(s.id, name);
    if (!s.apartment_id) continue;
    const list = studentsByApartment.get(s.apartment_id) ?? [];
    list.push({ id: s.id, full_name: name });
    studentsByApartment.set(s.apartment_id, list);
  }
  const supervised = (apartments ?? []).filter((a) => a.supervisor_id).length;

  return (
    <div className="stagger flex flex-col gap-6">
      <PageHeader
        eyebrow="الإدارة"
        title="الفريق والصلاحيات"
        description="أضف الإداريين وحدّد الأقسام التي يديرها كلٌّ منهم، وعيّن مشرفي الشقق"
        action={<NewStaffDialog />}
      />

      <div className="stagger grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="فريق الإدارة" value={staff.length} icon={UsersRound} />
        <StatCard label="مدراء عامّون" value={staff.filter((s) => s.role === "super_admin").length} icon={Crown} tone="gold" />
        <StatCard label={`شقق لها مشرف من ${apartments?.length ?? 0}`} value={supervised} icon={DoorOpen} tone="success" />
      </div>

      {/* فريق الإدارة */}
      <Card>
        <CardHeader>
          <CardTitle>فريق الإدارة</CardTitle>
          <CardDescription>كل إداري يرى ويعدّل الأقسام المسموحة له فقط، والمدير العام يملك كل شيء</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="stagger grid gap-3 lg:grid-cols-2">
            {staff.map((s) => {
              const isSuper = s.role === "super_admin";
              const shown = s.permissions.slice(0, 4);
              return (
                <li
                  key={s.id}
                  className={cn(
                    "flex flex-col gap-3 rounded-2xl border bg-card p-4 transition-colors",
                    s.suspended && "border-dashed opacity-70",
                    isSuper && "border-gold/40"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                        isSuper ? "bg-gold/15 text-gold-foreground dark:text-gold" : "bg-primary/10 text-primary"
                      )}
                    >
                      {initials(s.fullName)}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate font-semibold">{s.fullName}</span>
                        {s.id === me.id && <Badge variant="outline">أنت</Badge>}
                        {s.suspended && <Badge variant="destructive">موقوف</Badge>}
                      </div>
                      <span className="truncate text-xs text-muted-foreground" dir="ltr">
                        {s.email}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {s.lastSignIn ? `آخر دخول: ${formatDateTime(s.lastSignIn)}` : "لم يسجّل الدخول بعد"}
                      </span>
                    </div>
                    <StaffActions
                      userId={s.id}
                      fullName={s.fullName}
                      role={s.role}
                      permissions={s.permissions}
                      suspended={s.suspended}
                      isSelf={s.id === me.id}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {isSuper ? (
                      <span className="flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-1 text-xs font-medium text-gold-foreground dark:text-gold">
                        <Crown className="size-3" /> مدير عام — كل الصلاحيات
                      </span>
                    ) : s.permissions.length === ALL_PERMISSIONS.length ? (
                      <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        <ShieldCheck className="size-3" /> كل الأقسام
                      </span>
                    ) : (
                      <>
                        {shown.map((k) => (
                          <span key={k} className="rounded-full bg-muted px-2.5 py-1 text-xs">
                            {permissionLabel(k)}
                          </span>
                        ))}
                        {s.permissions.length > shown.length && (
                          <span className="rounded-full px-1.5 py-1 text-xs text-muted-foreground">
                            +{s.permissions.length - shown.length}
                          </span>
                        )}
                        {s.permissions.length === 0 && <span className="text-xs text-destructive">بلا صلاحيات</span>}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {/* مشرفو الشقق */}
      <Card>
        <CardHeader>
          <CardTitle>مشرفو الشقق</CardTitle>
          <CardDescription>المشرف طالب من سكان الشقة يساعد في متابعتها يومياً — اختره من طلاب الشقة نفسها</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-2 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground sm:grid-cols-3">
            <span className="flex items-center gap-2">
              <ClipboardCheck className="size-4 text-primary" /> يسجّل ويعتمد حضور طلاب شقته
            </span>
            <span className="flex items-center gap-2">
              <MessageSquareWarning className="size-4 text-primary" /> يتابع شكاوى الشقة ويردّ عليها
            </span>
            <span className="flex items-center gap-2">
              <SprayCan className="size-4 text-primary" /> يوزّع مهام النظافة ويتحقق منها
            </span>
          </div>

          {apartments && apartments.length > 0 ? (
            <ul className="flex flex-col divide-y">
              {apartments.map((a) => {
                const residents = studentsByApartment.get(a.id) ?? [];
                return (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="flex flex-col leading-tight">
                      <span className="font-medium">{a.name}</span>
                      <span className="text-xs text-muted-foreground">
                        الطابق {a.floor_number} · {residents.length} طالب
                        {a.supervisor_id && nameById.get(a.supervisor_id) ? ` · المشرف: ${nameById.get(a.supervisor_id)}` : ""}
                      </span>
                    </div>
                    {residents.length > 0 ? (
                      <SupervisorSelect apartmentId={a.id} currentSupervisorId={a.supervisor_id} students={residents} />
                    ) : (
                      <span className="text-xs text-muted-foreground">لا يوجد طلاب في الشقة بعد</span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">لا توجد شقق بعد</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
