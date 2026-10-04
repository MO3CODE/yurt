import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { WIRD_SOURCE_LABELS, type WirdSource } from "@/lib/quran";

const STYLES: Record<WirdSource, string> = {
  platform: "bg-success/12 text-success",
  mushaf: "bg-warning/18 text-warning-foreground dark:text-warning",
  both: "bg-primary/12 text-primary",
};

/** مصدر الورد: منصة / مصحف / كلاهما */
export function WirdSourceBadge({ source }: { source: WirdSource }) {
  return <Badge className={cn(STYLES[source])}>{WIRD_SOURCE_LABELS[source]}</Badge>;
}
