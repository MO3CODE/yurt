-- ============================================================================
-- Views: لوحة صحة السكن + لوحة النقاط، وحاويات التخزين
-- ============================================================================

-- ----------------------------------------------------------------------------
-- لوحة صحة السكن: مؤشر لكل شقة آخر ٧ أيام (نظافة + التزام + شكاوى مفتوحة)
-- ----------------------------------------------------------------------------
create or replace view public.apartment_health as
with window_students as (
  select s.id as student_id, s.apartment_id
  from public.students s
  where s.status = 'active'
),
cleaning_stats as (
  select
    t.apartment_id,
    count(*) filter (where ca.status = 'done') as done_count,
    count(*) as total_count
  from public.cleaning_assignments ca
  join public.cleaning_tasks t on t.id = ca.task_id
  where t.scope = 'apartment'
    and ca.week_start_date >= (current_date - interval '14 days')::date
  group by t.apartment_id
),
prayer_stats as (
  select
    ws.apartment_id,
    count(*) filter (where pr.status in ('mosque', 'prayed')) as good_count,
    count(*) as total_count
  from window_students ws
  join public.prayer_records pr on pr.student_id = ws.student_id
  where pr.record_date >= (current_date - interval '7 days')::date
  group by ws.apartment_id
),
attendance_stats as (
  select
    ws.apartment_id,
    count(*) filter (where ar.status in ('present', 'excused')) as good_count,
    count(*) as total_count
  from window_students ws
  join public.attendance_records ar on ar.student_id = ws.student_id
  where ar.record_date >= (current_date - interval '7 days')::date
  group by ws.apartment_id
),
complaint_stats as (
  select apartment_id, count(*) as open_count
  from public.complaints
  where status not in ('resolved', 'rejected')
    and apartment_id is not null
  group by apartment_id
)
select
  a.id as apartment_id,
  a.name,
  a.floor_number,
  a.supervisor_id,
  coalesce(round(100.0 * cs.done_count / nullif(cs.total_count, 0)), 100)::int as cleaning_score,
  coalesce(round(100.0 * ps.good_count / nullif(ps.total_count, 0)), 100)::int as prayer_score,
  coalesce(round(100.0 * ats.good_count / nullif(ats.total_count, 0)), 100)::int as attendance_score,
  coalesce(cm.open_count, 0) as open_complaints,
  greatest(
    0,
    round(
      (
        coalesce(round(100.0 * cs.done_count / nullif(cs.total_count, 0)), 100) * 0.35
        + coalesce(round(100.0 * ps.good_count / nullif(ps.total_count, 0)), 100) * 0.3
        + coalesce(round(100.0 * ats.good_count / nullif(ats.total_count, 0)), 100) * 0.25
        - coalesce(cm.open_count, 0) * 5
      )
    )
  )::int as overall_score
from public.apartments a
left join cleaning_stats cs on cs.apartment_id = a.id
left join prayer_stats ps on ps.apartment_id = a.id
left join attendance_stats ats on ats.apartment_id = a.id
left join complaint_stats cm on cm.apartment_id = a.id;

comment on view public.apartment_health is 'مؤشر صحة كل شقة (0-100) لبناء اللوحة اللونية للإدارة';

-- ----------------------------------------------------------------------------
-- لوحة النقاط الشهرية للطلاب
-- ----------------------------------------------------------------------------
create or replace view public.points_leaderboard as
select
  s.id as student_id,
  p.full_name,
  s.apartment_id,
  date_trunc('month', pe.created_at)::date as month,
  sum(pe.points) as total_points
from public.points_entries pe
join public.students s on s.id = pe.student_id
join public.profiles p on p.id = s.id
group by s.id, p.full_name, s.apartment_id, date_trunc('month', pe.created_at);

comment on view public.points_leaderboard is 'إجمالي نقاط كل طالب مجمّعة شهرياً';

-- ----------------------------------------------------------------------------
-- ملف الطالب الشامل (يُستخدم كأساس لتقارير الجهة المانحة)
-- ----------------------------------------------------------------------------
create or replace view public.student_profile_summary as
select
  s.id as student_id,
  p.full_name,
  s.apartment_id,
  a.name as apartment_name,
  s.university_name,
  s.major,
  s.status,
  (select count(*) from public.attendance_records ar where ar.student_id = s.id and ar.status = 'absent') as total_absences,
  (select count(*) from public.complaints c where c.student_id = s.id) as total_complaints,
  (select coalesce(sum(points), 0) from public.points_entries pe where pe.student_id = s.id) as total_points,
  (select count(*) from public.health_records hr where hr.student_id = s.id and hr.status = 'ongoing') as ongoing_health_issues
from public.students s
join public.profiles p on p.id = s.id
left join public.apartments a on a.id = s.apartment_id;

-- ----------------------------------------------------------------------------
-- حاويات التخزين (Storage Buckets)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('complaint-attachments', 'complaint-attachments', false),
  ('cleaning-photos', 'cleaning-photos', false),
  ('facility-photos', 'facility-photos', false),
  ('reports', 'reports', false)
on conflict (id) do nothing;

create policy "avatars_public_read" on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars_owner_write" on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid() is not null);

create policy "app_uploads_authenticated_read" on storage.objects for select
  using (bucket_id in ('complaint-attachments', 'cleaning-photos', 'facility-photos', 'reports') and auth.uid() is not null);

create policy "app_uploads_authenticated_write" on storage.objects for insert
  with check (bucket_id in ('complaint-attachments', 'cleaning-photos', 'facility-photos', 'reports') and auth.uid() is not null);
