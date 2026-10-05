import Link from "next/link";
import { Clock, PlayCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, LEVEL_LABELS, formatDuration, unitsLabel, type CourseCategory, type CourseLevel } from "@/lib/learning";

export type CourseCardData = {
  id: string;
  title: string;
  category: CourseCategory;
  level: CourseLevel | null;
  coverUrl: string | null;
  units: number;
  totalSeconds: number;
};

/** بطاقة كورس في القائمة؛ progress اختياري للكورسات المنضم إليها */
export function CourseCard({
  course,
  href,
  progress,
  badge,
}: {
  course: CourseCardData;
  href: string;
  progress?: { done: number; total: number };
  badge?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-soft transition-shadow hover:shadow-lift"
    >
      <div className="relative aspect-video overflow-hidden bg-muted">
        {course.coverUrl ? (
          // صور يوتيوب الخارجية: لا نمرّرها عبر next/image حتى لا نحتاج إعداد نطاقات
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.coverUrl}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <PlayCircle className="size-10" />
          </div>
        )}
        <div className="absolute start-2 top-2 flex gap-1">
          <Badge className="bg-black/60 text-white backdrop-blur">{CATEGORY_LABELS[course.category]}</Badge>
          {badge}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <span className="line-clamp-2 font-medium leading-snug">{course.title}</span>
        <span className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <PlayCircle className="size-3.5" /> {unitsLabel(course.units)}
          </span>
          {course.totalSeconds > 0 && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" /> {formatDuration(course.totalSeconds)}
            </span>
          )}
          {course.level && <span>{LEVEL_LABELS[course.level]}</span>}
        </span>
        {progress && (
          <Progress
            value={progress.total ? (progress.done / progress.total) * 100 : 0}
            aria-label="تقدّمك في الكورس"
            className={cn(progress.done >= progress.total && "[&_[data-slot=progress-indicator]]:bg-success")}
          />
        )}
      </div>
    </Link>
  );
}
