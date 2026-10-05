"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { leaveCourse } from "@/app/app/learn/actions";
import { unwrap } from "@/lib/unwrap";

export function LeaveCourseButton({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function leave() {
    startTransition(async () => {
      try {
        await unwrap(leaveCourse(courseId));
        toast.success("غادرت الكورس");
        setOpen(false);
        router.push("/app/learn");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر ذلك");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" className="text-muted-foreground" />}>
        <LogOut /> مغادرة الكورس
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>مغادرة الكورس؟</DialogTitle>
          <DialogDescription>سيُحذف تقدّمك فيه وتختفي دروسه من مهامك. يمكنك الانضمام مرة أخرى لاحقاً.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="destructive" onClick={leave} disabled={isPending}>
            {isPending && <Spinner />}
            مغادرة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
