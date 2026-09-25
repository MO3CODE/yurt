import Link from "next/link";
import { History, Minus, Pencil, Plus } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { AUDIT_ACTION_LABELS, AUDIT_TABLE_LABELS, describeChanges } from "@/lib/audit-labels";
import { APP_TIMEZONE } from "@/lib/date";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

export const metadata = { title: "سجل النشاط" };

const LIMIT = 150;

const dayFormat = new Intl.DateTimeFormat("ar-u-nu-arab", { timeZone: APP_TIMEZONE, weekday: "long", day: "numeric", month: "long" });
const timeFormat = new Intl.DateTimeFormat("ar-u-nu-arab", { timeZone: APP_TIMEZONE, hour: "numeric", minute: "2-digit" });
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE });

const ACTION_STYLE: Record<string, { icon: typeof Plus; className: string }> = {
  INSERT: { icon: Plus, className: "bg-success/12 text-success" },
  UPDATE: { icon: Pencil, className: "bg-primary/10 text-primary" },
  DELETE: { icon: Minus, className: "bg-destructive/10 text-destructive" },
};

export default async function ActivityPage({ searchParams }: PageProps<"/admin/activity">) {
  await requireSuperAdmin();
  const { table } = await searchParams;
  const tableFilter = typeof table === "string" && AUDIT_TABLE_LABELS[table] ? table : null;

  const supabase = await createClient();
  let query = supabase
    .from("audit_log")
    .select("id, created_at, table_name, record_id, action, changes, actor:profiles!audit_log_actor_id_fkey(full_name, role)")
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (tableFilter) query = query.eq("table_name", tableFilter);
  const { data: entries } = await query;

  // أسماء الطلاب المعنيين (من student_id في البيانات، أو المعرّف نفسه لجداول الحسابات)
  const subjectIds = new Set<string>();
  for (const e of entries ?? []) {
    const c = e.changes as Record<string, unknown> | null;
    const sid = c && typeof c.student_id === "string" ? c.student_id : null;
    if (sid) subjectIds.add(sid);
    if ((e.table_name === "profiles" || e.table_name === "students") && e.record_id) subjectIds.add(e.record_id);
  }
  const { data: subjects } = subjectIds.size
    ? await supabase.from("profiles").select("id, full_name").in("id", [...subjectIds])
    : { data: [] as { id: string; full_name: string }[] };
  const nameById = new Map((subjects ?? []).map((p) => [p.id, p.full_name]));

  // تجميع حسب اليوم
  const days: { key: string; label: string; items: NonNullable<typeof entries> }[] = [];
  for (const e of entries ?? []) {
    const key = dayKey.format(new Date(e.created_at));
    let day = days.at(-1);
    if (!day || day.key !== key) {
      day = { key, label: dayFormat.format(new Date(e.created_at)), items: [] };
      days.push(day);
    }
    day.items.push(e);
  }

  return (
    <div className="stagger flex flex-col gap-6">
      <PageHeader
        eyebrow="الإدارة"
        title="سجل النشاط"
        description={`كل تعديل يجريه الإداريون والمشرفون — آخر ${LIMIT} عملية. تسجيل الطالب اليومي لنفسه لا يظهر هنا.`}
      />

      <div className="flex flex-wrap gap-1.5">
        <FilterChip href="/admin/activity" active={!tableFilter} label="الكل" />
        {Object.entries(AUDIT_TABLE_LABELS).map(([key, label]) => (
          <FilterChip key={key} href={`/admin/activity?table=${key}`} active={tableFilter === key} label={label} />
        ))}
      </div>

      {days.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <History />
          </EmptyMedia>
          <EmptyTitle>لا يوجد نشاط بعد</EmptyTitle>
          <EmptyDescription>ستظهر هنا كل التعديلات التي يجريها فريق الإدارة والمشرفون</EmptyDescription>
        </Empty>
      ) : (
        days.map((day) => (
          <section key={day.key} className="flex flex-col gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <span className="size-1.5 rotate-45 bg-gold" aria-hidden />
              {day.label}
            </h2>
            <Card size="sm">
              <CardContent>
                <ol className="flex flex-col divide-y">
                  {day.items.map((e) => {
                    const actor = e.actor as unknown as { full_name: string; role: string } | null;
                    const style = ACTION_STYLE[e.action] ?? ACTION_STYLE.UPDATE;
                    const Icon = style.icon;
                    const c = e.changes as Record<string, unknown> | null;
                    const sid = c && typeof c.student_id === "string" ? c.student_id : null;
                    const subject =
                      (sid && nameById.get(sid)) ||
                      ((e.table_name === "profiles" || e.table_name === "students") && e.record_id
                        ? nameById.get(e.record_id)
                        : null);
                    const lines = describeChanges(e.action, e.changes);
                    return (
                      <li key={e.id} className="flex items-start gap-3 py-2.5">
                        <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg", style.className)}>
                          <Icon className="size-3.5" />
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <p className="text-sm">
                            <span className="font-semibold">{actor?.full_name ?? "النظام"}</span>
                            {actor && <span className="text-xs text-muted-foreground"> ({ROLE_LABELS[actor.role] ?? actor.role})</span>}{" "}
                            {AUDIT_ACTION_LABELS[e.action] ?? e.action} {AUDIT_TABLE_LABELS[e.table_name] ?? e.table_name}
                            {subject && (
                              <>
                                {" "}
                                — <span className="font-medium">{subject}</span>
                              </>
                            )}
                          </p>
                          {lines.length > 0 && (
                            <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                              {lines.map((l) => (
                                <li key={l}>{l}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <time className="shrink-0 text-xs text-muted-foreground tabular-nums" dateTime={e.created_at}>
                          {timeFormat.format(new Date(e.created_at))}
                        </time>
                      </li>
                    );
                  })}
                </ol>
              </CardContent>
            </Card>
          </section>
        ))
      )}
    </div>
  );
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/40 hover:text-primary"
      )}
    >
      {label}
    </Link>
  );
}
