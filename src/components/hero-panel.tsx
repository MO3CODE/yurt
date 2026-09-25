import { GeometricPattern } from "@/components/brand/khatam";
import { cn } from "@/lib/utils";

/** لوح ترحيبي زمرّدي بنقش هندسي — نفس روح الشريط الجانبي */
export function HeroPanel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section
      className={cn(
        "relative isolate overflow-hidden rounded-3xl bg-sidebar p-6 text-sidebar-foreground shadow-lift md:p-8 dark:bg-linear-to-bl dark:from-[oklch(0.26_0.045_182)] dark:to-sidebar dark:ring-1 dark:ring-white/10",
        className
      )}
    >
      <div className="absolute -start-24 -top-24 -z-10 size-[26rem] opacity-[0.12] [mask-image:radial-gradient(circle,black_30%,transparent_70%)]">
        <GeometricPattern className="animate-drift text-sidebar-primary" size={52} />
      </div>
      <div className="absolute -bottom-32 -end-20 -z-10 size-80 rounded-full bg-sidebar-primary/15 blur-3xl" aria-hidden />
      {children}
    </section>
  );
}
