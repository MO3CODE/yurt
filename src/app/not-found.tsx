import Link from "next/link";
import { Button } from "@/components/ui/button";
import { KhatamMark, GeometricPattern } from "@/components/brand/khatam";

export default function NotFound() {
  return (
    <div className="relative isolate flex min-h-svh flex-col items-center justify-center gap-6 overflow-hidden p-6 text-center">
      <div className="absolute inset-0 -z-10 opacity-[0.05] [mask-image:radial-gradient(circle,black,transparent_65%)]">
        <GeometricPattern className="text-primary" size={60} />
      </div>
      <KhatamMark className="page-enter size-16" />
      <div className="page-enter flex flex-col gap-2">
        <span className="font-heading text-6xl font-semibold text-gold-gradient">٤٠٤</span>
        <h1 className="font-heading text-2xl font-semibold">الصفحة غير موجودة</h1>
        <p className="text-sm text-muted-foreground">ربما نُقلت أو أن الرابط غير صحيح.</p>
      </div>
      <Button nativeButton={false} render={<Link href="/" />}>
        العودة للرئيسية
      </Button>
    </div>
  );
}
