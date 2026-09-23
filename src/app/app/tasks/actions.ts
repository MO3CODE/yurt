"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";

const taskSchema = z.object({
  title: z.string().min(1, "العنوان مطلوب"),
  description: z.string().optional(),
  due_date: z.string().optional(),
});

export async function createTask(formData: FormData) {
  const user = await requireUser();
  const parsed = taskSchema.parse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    due_date: formData.get("due_date") || undefined,
  });

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({
    student_id: user.id,
    title: parsed.title,
    description: parsed.description ?? null,
    due_date: parsed.due_date ?? null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/app/tasks");
  revalidatePath("/app");
}

export async function toggleTask(taskId: string, done: boolean) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ status: done ? "done" : "pending" })
    .eq("id", taskId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/tasks");
  revalidatePath("/app");
}

export async function deleteTask(taskId: string) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/tasks");
  revalidatePath("/app");
}
