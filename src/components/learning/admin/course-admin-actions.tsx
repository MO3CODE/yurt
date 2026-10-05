"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { deleteCourse, setCoursePublished } from "@/app/admin/learning/actions";
import { unwrap } from "@/lib/unwrap";

export function CourseAdminActions({ courseId, published, title }: { courseId: string; published: boolean; title: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function togglePublish() {
    startTransition(async () => {
      try {
        await unwrap(setCoursePublished(courseId, !published));
        toast.success(published ? "أُخفي الكورس عن الطلاب" : "نُشر الكورس للطلاب");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر ذلك");
      }
    });
  }

  function remove() {
    if (!window.confirm(`حذف كورس «${title}» نهائياً؟ يُحذف معه انضمام الطلاب وتقدّمهم.`)) return;
    startTransition(async () => {
      try {
        await unwrap(deleteCourse(courseId));
        toast.success("حُذف الكورس");
        router.push("/admin/learning");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر الحذف");
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={togglePublish} disabled={isPending} variant={published ? "outline" : "default"}>
        {isPending ? <Spinner /> : published ? <EyeOff /> : <Eye />}
        {published ? "إخفاء عن الطلاب" : "نشر للطلاب"}
      </Button>
      <Button variant="outline" nativeButton={false} render={<Link href={`/app/learn/${courseId}`} target="_blank" />}>
        <ExternalLink /> معاينة
      </Button>
      <Button variant="ghost" className="text-destructive" onClick={remove} disabled={isPending}>
        <Trash2 /> حذف الكورس
      </Button>
    </div>
  );
}
