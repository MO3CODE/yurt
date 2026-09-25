"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert />
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">حدث خطأ غير متوقع</h2>
        <p className="text-sm text-muted-foreground">حاول مرة أخرى، وإذا تكرر الخطأ تواصل مع الإدارة.</p>
        {error.digest && <p className="font-mono text-xs text-muted-foreground" dir="ltr">{error.digest}</p>}
      </div>
      <div className="flex gap-2">
        <Button onClick={() => retry()}>إعادة المحاولة</Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
          الصفحة الرئيسية
        </Button>
      </div>
    </div>
  );
}
