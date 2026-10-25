"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/lib/action-result";
import { hasPermission, requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

// مواد الترم: يسجّلها الطالب لنفسه، أو الإدارة (academic) لأي طالب

const courseSchema = z.object({
  name: z.string().trim().min(2, "اكتب اسم المادة").max(120),
  code: z.string().trim().max(20),
  instructor: z.string().trim().max(80),
});

const addSchema = z.object({
  studentId: z.string().uuid().nullable(),
  termId: z.string().uuid(),
  courses: z.array(courseSchema).min(1).max(15),
});

function refresh(studentId: string) {
  revalidatePath("/app/grades");
  revalidatePath(`/admin/academic/${studentId}`);
  revalidatePath("/admin/academic/subjects");
}

export async function addTermCourses(input: z.input<typeof addSchema>) {
  return runAction(async () => {
    const user = await requireUser();
    const v = addSchema.parse(input);
    const studentId = v.studentId ?? user.id;
    if (studentId !== user.id && !hasPermission(user, "academic")) throw new Error("لا تملك صلاحية المتابعة الأكاديمية");
    if (studentId === user.id && user.role !== "student") throw new Error("اختر الطالب");

    const supabase = await createClient();
    const { data: term } = await supabase.from("academic_terms").select("historical").eq("id", v.termId).single();
    if (!term) throw new Error("الترم غير موجود");
    if (term.historical) throw new Error("ترم أرشيفي — لا تُضاف له مواد");

    const { error } = await supabase.from("student_term_courses").insert(
      v.courses.map((c) => ({
        student_id: studentId,
        term_id: v.termId,
        course_name: c.name.replace(/\s+/g, " "),
        course_code: c.code || null,
        instructor: c.instructor || null,
        created_by: user.id,
      }))
    );
    if (error) throw new Error(error.code === "23505" ? "المادة مسجّلة من قبل في هذا الترم" : error.message);
    refresh(studentId);
  });
}

export async function removeTermCourse(id: string) {
  return runAction(async () => {
    await requireUser();
    const supabase = await createClient();
    // السياسات تسمح للطالب بحذف مواده فقط، وللإدارة بالكل
    const { data, error } = await supabase.from("student_term_courses").delete().eq("id", z.string().uuid().parse(id)).select("student_id");
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error("لا يمكن حذف هذه المادة");
    refresh(data[0].student_id);
  });
}
