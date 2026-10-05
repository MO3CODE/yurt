import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WirdForm } from "@/components/student/wird-form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WirdSourceBadge } from "@/components/quran/wird-source-badge";
import { BookOpen, Bookmark, Search, Target } from "lucide-react";
import { HifzPanel } from "@/components/quran/hifz-panel";
import type { HifzStatus } from "@/lib/quran/hifz";
import { QuranPlanDialog } from "@/components/quran/quran-plan-dialog";
import { WirdStats } from "@/components/quran/wird-stats";
import { buildTotals } from "@/lib/quran/stats";
import { addDaysISO, todayISO } from "@/lib/date";
import { QURAN_PAGES, arNum, describePages, pageInfo, pageSpan, pagesLabel, wirdSource } from "@/lib/quran";

const HISTORY_DAYS = 14;

export default async function QuranPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const today = todayISO();
  const since = addDaysISO(today, -(HISTORY_DAYS - 1));

  const yearStart = addDaysISO(today, -364);
  const [{ data: logs }, { data: reads }, { data: progress }, { data: yearPlatform }, { data: yearLogs }, { data: hifz }] = await Promise.all([
    supabase
      .from("quran_wird_logs")
      .select("*")
      .eq("student_id", user.id)
      .gte("record_date", since)
      .order("record_date", { ascending: false }),
    supabase.from("quran_page_reads").select("record_date, page").eq("student_id", user.id).gte("record_date", since),
    supabase
      .from("quran_progress")
      .select("current_page, khatmas, daily_goal, review_pages, review_cursor, last_review_date")
      .eq("student_id", user.id)
      .maybeSingle(),
    // سنة للإحصائيات والسلسلة (صف لكل يوم)
    supabase.from("quran_platform_daily").select("record_date, pages").eq("student_id", user.id).gte("record_date", yearStart),
    supabase.from("quran_wird_logs").select("record_date, pages").eq("student_id", user.id).gte("record_date", yearStart),
    supabase.from("quran_hifz").select("surah, status").eq("student_id", user.id),
  ]);
  const totals = buildTotals(yearPlatform ?? [], yearLogs ?? []);

  const readsByDate = new Map<string, number[]>();
  for (const r of reads ?? []) {
    if (!readsByDate.has(r.record_date)) readsByDate.set(r.record_date, []);
    readsByDate.get(r.record_date)!.push(r.page);
  }
  const logByDate = new Map((logs ?? []).map((l) => [l.record_date, l]));

  const todayLog = logByDate.get(today) ?? null;
  const todayPlatform = readsByDate.get(today) ?? [];
  const todayMushaf = Number(todayLog?.pages ?? 0);

  const bookmark = progress?.current_page ?? 1;
  const khatmas = progress?.khatmas ?? 0;
  const dailyGoal = progress?.daily_goal ?? null;
  const todayTotal = todayPlatform.length + todayMushaf;
  const remaining = dailyGoal ? Math.max(0, dailyGoal - todayTotal) : 0;
  // الصفحات المنجزة في الختمة الحالية = ما قبل العلامة
  const done = bookmark - 1;

  const history = [...new Set([...logByDate.keys(), ...readsByDate.keys()])]
    .filter((d) => d !== today)
    .sort((a, b) => b.localeCompare(a))
    .map((date) => {
      const log = logByDate.get(date);
      const platform = readsByDate.get(date) ?? [];
      const description = [platform.length ? describePages(platform) : null, log?.range_description]
        .filter(Boolean)
        .join(" · ");
      return {
        date,
        description,
        pages: platform.length + Number(log?.pages ?? 0),
        source: wirdSource(platform.length, Boolean(log)),
        memorization: log?.memorization ?? false,
      };
    });

  return (
    <div className="stagger flex flex-col gap-6">
      <PageHeader
        title="الورد القرآني"
        description="اقرأ من المنصة أو سجّل وردك من مصحفك"
        action={
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/app/quran/search" />}>
            <Search /> البحث والعلامات
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">ورد اليوم</p>
              <p className="text-2xl font-semibold">
                {arNum(todayTotal)}
                {dailyGoal ? ` / ${arNum(dailyGoal)}` : ""} صفحة
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {todayPlatform.length > 0 && <Badge variant="secondary">المنصة {arNum(todayPlatform.length)}</Badge>}
              {todayMushaf > 0 && <Badge variant="outline">المصحف {arNum(todayMushaf)}</Badge>}
              <QuranPlanDialog
                bookmark={bookmark}
                dailyGoal={dailyGoal}
                trigger={
                  <Button variant="outline" size="sm">
                    <Target /> {dailyGoal ? "خطة وردي" : "حدد وردك اليومي"}
                  </Button>
                }
              />
            </div>
          </div>
          {dailyGoal && (
            <>
              <Progress value={Math.min(100, (todayTotal / dailyGoal) * 100)} aria-label="تقدّم ورد اليوم" />
              <p className="text-sm text-muted-foreground">
                {remaining === 0
                  ? "أتممت وردك اليوم، بارك الله فيك"
                  : `تبقّى لك ${pagesLabel(remaining)}: ${pageSpan(bookmark, remaining)}`}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="platform">
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value="platform">أقرأ من المنصة</TabsTrigger>
          <TabsTrigger value="mushaf">قرأت من مصحفي</TabsTrigger>
          <TabsTrigger value="hifz">حفظي</TabsTrigger>
        </TabsList>

        <TabsContent value="platform">
          <Card>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
                  <Bookmark className="size-5" />
                </span>
                <div>
                  <p className="text-sm text-muted-foreground">{done > 0 ? "تكمل من" : "ابدأ ختمتك من"}</p>
                  <p className="text-lg font-semibold">
                    صفحة {arNum(bookmark)} — سورة {pageInfo(bookmark).surah.name}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>الختمة الحالية</span>
                  <span className="tabular-nums">
                    {arNum(done)} / {arNum(QURAN_PAGES)}
                  </span>
                </div>
                <Progress value={(done / QURAN_PAGES) * 100} aria-label="تقدّم الختمة" />
                <p className="text-xs text-muted-foreground">ختمات مكتملة: {arNum(khatmas)}</p>
              </div>
              {todayPlatform.length > 0 && (
                <p className="text-sm text-muted-foreground">قرأت اليوم: {describePages(todayPlatform)}</p>
              )}
              <Button className="w-full sm:w-fit" nativeButton={false} render={<Link href="/app/quran/read" />}>
                <BookOpen /> {done > 0 ? "تابع القراءة" : "ابدأ القراءة"}
              </Button>
              <p className="text-xs text-muted-foreground">
                الصفحة تُحسب في وردك بعد ٣٠ ثانية من بقائها أمامك، والعلامة تتقدم مع القراءة بالتسلسل.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mushaf">
          <Card>
            <CardHeader>
              <CardTitle>ورد اليوم من المصحف</CardTitle>
            </CardHeader>
            <CardContent>
              <WirdForm
                date={today}
                defaults={{
                  range_description: todayLog?.range_description ?? "",
                  pages: todayLog?.pages ?? undefined,
                  reached_page: todayLog?.reached_page ?? undefined,
                  memorization: todayLog?.memorization ?? false,
                  note: todayLog?.note ?? "",
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="hifz">
          <HifzPanel
            initial={(hifz ?? []).map((h) => ({ surah: h.surah, status: h.status as HifzStatus }))}
            reviewPages={progress?.review_pages ?? null}
            cursor={progress?.review_cursor ?? 0}
            reviewedToday={progress?.last_review_date === today}
          />
        </TabsContent>
      </Tabs>

      <WirdStats totals={totals} today={today} goal={progress?.daily_goal ?? null} khatmas={progress?.khatmas ?? 0} />

      <Card>
        <CardHeader>
          <CardTitle>السجل السابق</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ</TableHead>
                <TableHead>الورد</TableHead>
                <TableHead>الصفحات</TableHead>
                <TableHead>المصدر</TableHead>
                <TableHead>حفظ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((h) => (
                <TableRow key={h.date}>
                  <TableCell className="font-medium">{h.date}</TableCell>
                  <TableCell className="whitespace-normal">{h.description || "—"}</TableCell>
                  <TableCell>{h.pages || "—"}</TableCell>
                  <TableCell>{h.source ? <WirdSourceBadge source={h.source} /> : "—"}</TableCell>
                  <TableCell>{h.memorization ? <Badge variant="secondary">نعم</Badge> : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
