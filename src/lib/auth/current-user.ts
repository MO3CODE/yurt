import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/supabase/types";
import { ALL_PERMISSIONS, isPermissionKey, permissionLabel, type PermissionKey } from "@/lib/auth/permissions";

export type CurrentUser = {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  role: AppRole;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  /** أقسام الإدارة المسموحة (كلها للمدير العام، ولا شيء للطالب) */
  permissions: PermissionKey[];
  apartmentId: string | null;
  apartmentName: string | null;
  supervisedApartmentId: string | null;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  let apartmentId: string | null = null;
  let apartmentName: string | null = null;

  if (profile.role === "student") {
    const { data: student } = await supabase
      .from("students")
      .select("apartment_id, apartments:apartment_id(name)")
      .eq("id", user.id)
      .single();

    apartmentId = student?.apartment_id ?? null;
    const apt = student?.apartments as { name: string } | null | undefined;
    apartmentName = apt?.name ?? null;
  }

  const { data: supervised } = await supabase
    .from("apartments")
    .select("id")
    .eq("supervisor_id", user.id)
    .maybeSingle();

  return {
    id: profile.id,
    fullName: profile.full_name,
    avatarUrl: profile.avatar_url,
    role: profile.role,
    isAdmin: profile.role === "admin" || profile.role === "super_admin",
    isSuperAdmin: profile.role === "super_admin",
    permissions: resolvePermissions(profile.role, (profile as { permissions?: string[] | null }).permissions),
    apartmentId,
    apartmentName,
    supervisedApartmentId: supervised?.id ?? null,
  };
}

function resolvePermissions(role: AppRole, stored: string[] | null | undefined): PermissionKey[] {
  if (role === "super_admin") return ALL_PERMISSIONS;
  if (role !== "admin") return [];
  // قبل تطبيق migration 0007 لا يوجد عمود permissions: يبقى الإداري بكامل صلاحياته كما كان
  if (stored === undefined) return ALL_PERMISSIONS;
  return (stored ?? []).filter(isPermissionKey);
}

export function hasPermission(user: Pick<CurrentUser, "permissions">, key: PermissionKey): boolean {
  return user.permissions.includes(key);
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/");
  return user;
}

export async function requireSuperAdmin(): Promise<CurrentUser> {
  const user = await requireAdmin();
  if (!user.isSuperAdmin) redirect("/admin");
  return user;
}

/** لصفحات الإدارة: يحوّل لمن لا يملك الصلاحية إلى لوحة التحكم */
export async function requirePermission(key: PermissionKey): Promise<CurrentUser> {
  const user = await requireAdmin();
  if (!hasPermission(user, key)) redirect("/admin?denied=" + key);
  return user;
}

/** للـ Server Actions: يرمي خطأً برسالة واضحة بدل التحويل */
export async function assertPermission(key: PermissionKey): Promise<CurrentUser> {
  const user = await requireAdmin();
  if (!hasPermission(user, key)) throw new Error(`ليست لديك صلاحية «${permissionLabel(key)}»`);
  return user;
}

export async function assertSuperAdmin(): Promise<CurrentUser> {
  const user = await requireAdmin();
  if (!user.isSuperAdmin) throw new Error("هذا الإجراء للمدير العام فقط");
  return user;
}
