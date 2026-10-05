"use client";

import { useRouter } from "next/navigation";
import { CrudDialog } from "@/components/crud-dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createCourse, updateCourse } from "@/app/admin/learning/actions";
import { COURSE_CATEGORIES, COURSE_LEVELS } from "@/lib/learning";

const categoryItems = COURSE_CATEGORIES.map((c) => ({ value: c.key, label: c.label }));
const levelItems = [{ value: "", label: "بدون" }, ...COURSE_LEVELS.map((l) => ({ value: l.key, label: l.label }))];

export type CourseFormValues = { title: string; category: string; level: string | null; description: string | null };

/** إنشاء كورس جديد (ثم الانتقال لصفحته لإضافة الدروس) أو تعديل بياناته */
export function CourseFormDialog({
  trigger,
  courseId,
  defaults,
}: {
  trigger: React.ReactNode;
  courseId?: string;
  defaults?: CourseFormValues;
}) {
  const router = useRouter();
  const editing = Boolean(courseId);

  async function action(formData: FormData) {
    if (editing) return updateCourse(courseId!, formData);
    const r = await createCourse(formData);
    if (r.ok) router.push(`/admin/learning/${r.data.id}`);
    return r;
  }

  return (
    <CrudDialog
      trigger={trigger}
      title={editing ? "تعديل بيانات الكورس" : "كورس جديد"}
      description={editing ? undefined : "بعد الإنشاء تضيف الدروس من بلاي ليست يوتيوب أو برابط كل فيديو"}
      action={action}
      submitLabel={editing ? "حفظ" : "إنشاء"}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="course-title">العنوان</FieldLabel>
          <Input id="course-title" name="title" required minLength={2} maxLength={120} defaultValue={defaults?.title} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel>القسم</FieldLabel>
            <Select name="category" items={categoryItems} defaultValue={defaults?.category}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="اختر القسم" />
              </SelectTrigger>
              <SelectContent>
                {categoryItems.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>المستوى</FieldLabel>
            <Select name="level" items={levelItems} defaultValue={defaults?.level ?? ""}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="بدون" />
              </SelectTrigger>
              <SelectContent>
                {levelItems.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="course-description">عن الكورس</FieldLabel>
          <Textarea
            id="course-description"
            name="description"
            rows={5}
            maxLength={4000}
            defaultValue={defaults?.description ?? ""}
            placeholder="ماذا سيتعلم الطالب؟ لمن هذا الكورس؟ (إن تركته فارغاً يُؤخذ وصف البلاي ليست عند الاستيراد)"
          />
        </Field>
      </FieldGroup>
    </CrudDialog>
  );
}
