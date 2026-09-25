import Link from "next/link";
import { ArrowUpLeft, type LucideIcon } from "lucide-react";
import { AnimatedNumber } from "@/components/animated-number";
import { GeometricPattern } from "@/components/brand/khatam";
import { cn } from "@/lib/utils";

type Tone = "default" | "gold" | "success" | "warning" | "destructive";

const tones: Record<Tone, { tile: string; pattern: string; glow: string }> = {
  default: { tile: "bg-primary/10 text-primary", pattern: "text-primary", glow: "from-primary/10" },
  gold: { tile: "bg-gold/15 text-gold-foreground dark:text-gold", pattern: "text-gold", glow: "from-gold/15" },
  success: { tile: "bg-success/12 text-success", pattern: "text-success", glow: "from-success/10" },
  warning: { tile: "bg-warning/18 text-warning-foreground dark:text-warning", pattern: "text-warning", glow: "from-warning/12" },
  destructive: { tile: "bg-destructive/10 text-destructive", pattern: "text-destructive", glow: "from-destructive/10" },
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  hint,
  href,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone?: Tone;
  hint?: string;
  href?: string;
}) {
  const t = tones[tone];
  const body = (
    <>
      {/* وهج لوني ونقش هندسي خفيف في الزاوية */}
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-bl to-transparent to-60%", t.glow)} />
      <div
        className="pointer-events-none absolute -top-6 -start-6 size-32 opacity-[0.09] [mask-image:radial-gradient(circle_at_top_right,black,transparent_70%)]"
        aria-hidden
      >
        <GeometricPattern className={t.pattern} size={40} />
      </div>

      <div className="relative flex items-start justify-between gap-3">
        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl sm:size-11", t.tile)}>
          <Icon className="size-4 sm:size-5" />
        </div>
        {href && (
          <ArrowUpLeft className="size-4 text-muted-foreground opacity-0 transition-all duration-300 group-hover/stat:-translate-x-0.5 group-hover/stat:-translate-y-0.5 group-hover/stat:opacity-100" />
        )}
      </div>
      <div className="relative mt-3 flex flex-col gap-1 sm:mt-4">
        <span className="font-heading text-2xl leading-none font-semibold tracking-tight sm:text-3xl">
          {typeof value === "number" ? <AnimatedNumber value={value} /> : value}
        </span>
        <span className="text-xs leading-snug text-muted-foreground sm:text-sm">{label}</span>
        {hint && <span className="hidden text-xs text-muted-foreground/80 sm:block">{hint}</span>}
      </div>
    </>
  );

  const className =
    "group/stat relative isolate overflow-hidden rounded-2xl bg-card p-3.5 sm:p-5 text-card-foreground shadow-soft ring-1 ring-foreground/[0.07]";

  return href ? (
    <Link href={href} className={cn(className, "card-interactive focus-visible:ring-2 focus-visible:ring-ring outline-none")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
