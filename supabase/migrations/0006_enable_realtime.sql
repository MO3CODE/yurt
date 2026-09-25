-- =====================================================================
-- 0006 — تفعيل التحديث الفوري (Realtime) بين الطالب والإدارة
-- الواجهة (src/components/live-sync.tsx) تشترك في تغييرات هذه الجداول
-- وتعيد تحميل بيانات الصفحة فوراً. RLS تنطبق: كل مستخدم يستقبل فقط
-- تغييرات الصفوف التي يحق له قراءتها.
-- =====================================================================

alter publication supabase_realtime add table
  public.prayer_records,
  public.attendance_records,
  public.quran_wird_logs,
  public.complaints,
  public.academic_support_requests,
  public.health_records,
  public.facility_issues,
  public.cleaning_assignments,
  public.cleaning_tasks,
  public.alerts,
  public.notifications,
  public.points_entries,
  public.students;
