import Link from "next/link";
import { BookOpenText, CheckCircle2, Layers, PenLine, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { arNum } from "@/lib/quran";
import { formatDuration, type UnitKind } from "@/lib/learning";

const KIND_ICONS: Record<UnitKind, typeof PlayCircle> = {
  video: PlayCircle,
  reading: BookOpenText,
  vocab: Layers,
  writing: PenLine,
};

export type UnitRow = { id: string; title: string; kind: UnitKind; durationSeconds: number | null; done?: boolean };

/** قائمة وحدات الكورس مرقّمة؛ روابط للمنضمين فقط */
export function UnitList({
  units,
  hrefFor,
  currentId,
}: {
  units: UnitRow[];
  hrefFor?: (id: string) => string;
  currentId?: string;
}) {
  return (
    <ol className="flex flex-col divide-y rounded-2xl border bg-card">
      {units.map((u, i) => {
        const Icon = u.done ? CheckCircle2 : KIND_ICONS[u.kind];
        const body = (
          <>
            <span className="w-6 shrink-0 text-center text-xs text-muted-foreground tabular-nums">{arNum(i + 1)}</span>
            <Icon className={cn("size-4 shrink-0", u.done ? "text-success" : "text-muted-foreground")} />
            <span className={cn("min-w-0 flex-1 truncate text-sm", u.done && "text-muted-foreground")}>{u.title}</span>
            {u.durationSeconds ? <span className="shrink-0 text-xs text-muted-foreground">{formatDuration(u.durationSeconds)}</span> : null}
          </>
        );
        return (
          <li key={u.id}>
            {hrefFor ? (
              <Link
                href={hrefFor(u.id)}
                aria-current={currentId === u.id ? "step" : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50",
                  currentId === u.id && "bg-accent text-accent-foreground"
                )}
              >
                {body}
              </Link>
            ) : (
              <div className="flex items-center gap-3 px-3 py-2.5">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
