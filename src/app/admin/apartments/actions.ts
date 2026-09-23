"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/current-user";

const apartmentSchema = z.object({
  name: z.string().min(1, "اسم الشقة مطلوب"),
  floor_number: z.coerce.number().int(),
  capacity: z.coerce.number().int().min(0),
  notes: z.string().optional(),
});

export async function createApartment(formData: FormData) {
  await requireAdmin();
  const parsed = apartmentSchema.parse({
    name: formData.get("name"),
    floor_number: formData.get("floor_number"),
    capacity: formData.get("capacity"),
    notes: formData.get("notes") || undefined,
  });

  const supabase = await createClient();
  const { error } = await supabase.from("apartments").insert(parsed);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/apartments");
}

export async function updateApartmentSupervisor(apartmentId: string, supervisorId: string | null) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("apartments")
    .update({ supervisor_id: supervisorId })
    .eq("id", apartmentId);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/apartments/${apartmentId}`);
  revalidatePath("/admin/apartments");
}

export async function deleteApartment(apartmentId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("apartments").delete().eq("id", apartmentId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/apartments");
}
