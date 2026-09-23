import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/supabase/types";

export type CurrentUser = {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  role: AppRole;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  permissions: {
    manageAcademic: boolean;
    manageReligious: boolean;
    manageFacilities: boolean;
    manageReports: boolean;
  };
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
    permissions: {
      manageAcademic: profile.manage_academic,
      manageReligious: profile.manage_religious,
      manageFacilities: profile.manage_facilities,
      manageReports: profile.manage_reports,
    },
    apartmentId,
    apartmentName,
    supervisedApartmentId: supervised?.id ?? null,
  };
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
