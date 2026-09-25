-- =====================================================================
-- 0008 — فرض الصلاحيات في قاعدة البيانات + سجل النشاط + توقيت إسطنبول
--
-- القاعدة: القراءة التشغيلية العامة (الطلاب، الحضور، الصلاة، الورد، النقاط،
-- النظافة) متاحة لكل إداري حتى تبقى أرقام لوحة التحكم صحيحة؛ أما البيانات
-- الحساسة (الصحة، الشكاوى، الدعم الأكاديمي، التنبيهات، التقارير) فقراءتها
-- وكل عمليات الكتابة في أي قسم تتطلب صلاحيته عبر has_permission().
-- المدير العام: has_permission() = true دائماً.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) سياسات RLS حسب الصلاحية
-- ---------------------------------------------------------------------

-- الطلاب
drop policy if exists students_admin_write on public.students;
create policy students_admin_write on public.students for all
  using ((select public.has_permission('students')))
  with check ((select public.has_permission('students')));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update
  using (id = (select auth.uid()) or (select public.has_permission('students')));

drop policy if exists profiles_admin_insert on public.profiles;
create policy profiles_admin_insert on public.profiles for insert
  with check ((select public.has_permission('students')) or (id = (select auth.uid()) and role = 'student'));

-- الشقق
drop policy if exists apartments_admin_write on public.apartments;
create policy apartments_admin_write on public.apartments for all
  using ((select public.has_permission('apartments')))
  with check ((select public.has_permission('apartments')));

-- الحضور (القراءة لكل إداري، الكتابة بالصلاحية)
drop policy if exists attendance_insert on public.attendance_records;
create policy attendance_insert on public.attendance_records for insert
  with check (student_id = (select auth.uid()) or (select public.has_permission('attendance')) or public.supervises_student(student_id));

drop policy if exists attendance_update on public.attendance_records;
create policy attendance_update on public.attendance_records for update
  using (student_id = (select auth.uid()) or (select public.has_permission('attendance')) or public.supervises_student(student_id));

-- الصلاة والورد (القراءة لكل إداري، الكتابة بالصلاحية)
drop policy if exists prayer_write_own on public.prayer_records;
create policy prayer_write_own on public.prayer_records for all
  using (student_id = (select auth.uid()) or (select public.has_permission('prayers')))
  with check (student_id = (select auth.uid()) or (select public.has_permission('prayers')));

drop policy if exists wird_write_own on public.quran_wird_logs;
create policy wird_write_own on public.quran_wird_logs for all
  using (student_id = (select auth.uid()) or (select public.has_permission('quran')))
  with check (student_id = (select auth.uid()) or (select public.has_permission('quran')));

-- الصحة (حساسة: القراءة أيضاً بالصلاحية)
drop policy if exists health_select on public.health_records;
create policy health_select on public.health_records for select
  using (student_id = (select auth.uid()) or (select public.has_permission('health')) or public.supervises_student(student_id));

drop policy if exists health_write on public.health_records;
create policy health_write on public.health_records for all
  using (student_id = (select auth.uid()) or (select public.has_permission('health')) or public.supervises_student(student_id))
  with check (student_id = (select auth.uid()) or (select public.has_permission('health')) or public.supervises_student(student_id));

-- الدعم الأكاديمي (حساس)
drop policy if exists academic_support_select on public.academic_support_requests;
create policy academic_support_select on public.academic_support_requests for select
  using (student_id = (select auth.uid()) or (select public.has_permission('academic')));

drop policy if exists academic_support_update on public.academic_support_requests;
create policy academic_support_update on public.academic_support_requests for update
  using ((select public.has_permission('academic')));

drop policy if exists academic_support_insert on public.academic_support_requests;
create policy academic_support_insert on public.academic_support_requests for insert
  with check (
    (select public.has_permission('academic'))
    or (
      student_id = (select auth.uid())
      and status = 'open'
      and assigned_to_profile_id is null
      and assigned_to_name is null
      and admin_notes is null
    )
  );

-- الشكاوى (حساسة)
drop policy if exists complaints_select on public.complaints;
create policy complaints_select on public.complaints for select
  using (student_id = (select auth.uid()) or (select public.has_permission('complaints')) or public.is_apartment_supervisor(apartment_id));

drop policy if exists complaints_update on public.complaints;
create policy complaints_update on public.complaints for update
  using ((select public.has_permission('complaints')) or public.is_apartment_supervisor(apartment_id));

drop policy if exists complaints_insert on public.complaints;
create policy complaints_insert on public.complaints for insert
  with check (
    (select public.has_permission('complaints'))
    or (
      student_id = (select auth.uid())
      and status = 'new'
      and supervisor_response is null
      and admin_response is null
      and apartment_id is not distinct from (select s.apartment_id from public.students s where s.id = (select auth.uid()))
    )
  );

-- النظافة
drop policy if exists cleaning_tasks_admin_or_supervisor_write on public.cleaning_tasks;
create policy cleaning_tasks_admin_or_supervisor_write on public.cleaning_tasks for all
  using ((select public.has_permission('cleaning')) or public.is_apartment_supervisor(apartment_id))
  with check ((select public.has_permission('cleaning')) or public.is_apartment_supervisor(apartment_id));

drop policy if exists cleaning_assignments_write on public.cleaning_assignments;
create policy cleaning_assignments_write on public.cleaning_assignments for all
  using (
    (select public.has_permission('cleaning'))
    or exists (select 1 from public.cleaning_tasks t where t.id = task_id and public.is_apartment_supervisor(t.apartment_id))
  )
  with check (
    (select public.has_permission('cleaning'))
    or exists (select 1 from public.cleaning_tasks t where t.id = task_id and public.is_apartment_supervisor(t.apartment_id))
  );

-- المرافق
drop policy if exists facilities_admin_write on public.facilities;
create policy facilities_admin_write on public.facilities for all
  using ((select public.has_permission('facilities')))
  with check ((select public.has_permission('facilities')));

drop policy if exists facility_issues_admin_update on public.facility_issues;
create policy facility_issues_admin_update on public.facility_issues for update
  using ((select public.has_permission('facilities')));

-- النقاط (القراءة لكل إداري، المنح بالصلاحية)
drop policy if exists points_write on public.points_entries;
create policy points_write on public.points_entries for insert
  with check ((select public.has_permission('points')) or public.supervises_student(student_id));

-- التنبيهات (حساسة)
drop policy if exists alerts_admin_write on public.alerts;
create policy alerts_admin_write on public.alerts for all
  using ((select public.has_permission('alerts')))
  with check ((select public.has_permission('alerts')));

drop policy if exists alerts_select on public.alerts;
create policy alerts_select on public.alerts for select
  using ((select public.has_permission('alerts')) or public.is_apartment_supervisor(apartment_id) or student_id = (select auth.uid()));

-- الإشعارات
drop policy if exists notifications_write on public.notifications;
create policy notifications_write on public.notifications for insert
  with check (
    (select public.has_permission('notifications'))
    or (target_type = 'apartment' and public.is_apartment_supervisor(target_apartment_id))
  );

-- التقارير
drop policy if exists reports_admin_only on public.generated_reports;
create policy reports_admin_only on public.generated_reports for all
  using ((select public.has_permission('reports')))
  with check ((select public.has_permission('reports')));

-- ---------------------------------------------------------------------
-- 2) سجل النشاط: من غيّر ماذا ومتى (لا يُسجَّل تسجيل الطالب الذاتي اليومي)
-- ---------------------------------------------------------------------
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor_id uuid references public.profiles (id) on delete set null,
  table_name text not null,
  record_id text,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  changes jsonb
);

create index if not exists idx_audit_log_created on public.audit_log (created_at desc);
create index if not exists idx_audit_log_actor on public.audit_log (actor_id);

alter table public.audit_log enable row level security;

drop policy if exists audit_log_super_admin_read on public.audit_log;
create policy audit_log_super_admin_read on public.audit_log for select
  using ((select public.is_super_admin()));
-- لا سياسات كتابة: الإدراج يتم فقط عبر الـ trigger (security definer)

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_role app_role;
  old_j jsonb;
  new_j jsonb;
  row_j jsonb;
  diff jsonb;
begin
  if tg_op in ('INSERT', 'UPDATE') then new_j := to_jsonb(new); end if;
  if tg_op in ('UPDATE', 'DELETE') then old_j := to_jsonb(old); end if;
  row_j := coalesce(new_j, old_j);

  -- ما يفعله الطالب في بياناته هو (صلاة، ورد، حضور ذاتي، شكواه، ملفه) لا يُسجَّل
  if actor is not null then
    select role into actor_role from public.profiles where id = actor;
    if actor_role = 'student'
       and (row_j ->> 'student_id' = actor::text
            or (tg_table_name in ('profiles', 'students') and row_j ->> 'id' = actor::text)) then
      return null;
    end if;
  end if;

  if tg_op = 'UPDATE' then
    select jsonb_object_agg(n.key, jsonb_build_object('from', o.value, 'to', n.value))
      into diff
      from jsonb_each(new_j) n
      join jsonb_each(old_j) o using (key)
     where n.value is distinct from o.value
       and n.key <> 'updated_at';
    if diff is null then return null; end if;
  else
    diff := row_j;
  end if;

  insert into public.audit_log (actor_id, table_name, record_id, action, changes)
  values (actor, tg_table_name, row_j ->> 'id', tg_op, diff);
  return null;
end;
$$;

revoke execute on function public.write_audit_log() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'students', 'apartments', 'attendance_records', 'prayer_records', 'quran_wird_logs',
    'complaints', 'academic_support_requests', 'health_records', 'cleaning_tasks', 'cleaning_assignments',
    'points_entries', 'notifications', 'facilities', 'facility_issues', 'alerts'
  ]
  loop
    execute format('drop trigger if exists audit_log_trigger on public.%I', t);
    execute format(
      'create trigger audit_log_trigger after insert or update or delete on public.%I for each row execute function public.write_audit_log()',
      t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 3) التقارير بتوقيت إسطنبول (كانت بتوقيت UTC فتنزاح حتى ٣ ساعات)
-- ---------------------------------------------------------------------
create or replace view public.apartment_health
with (security_invoker = on) as
with today as (
  select (now() at time zone 'Europe/Istanbul')::date as d
), window_students as (
  select s.id as student_id, s.apartment_id
  from public.students s
  where s.status = 'active'
), cleaning_stats as (
  select t.apartment_id,
         count(*) filter (where ca.status = 'done') as done_count,
         count(*) as total_count
  from public.cleaning_assignments ca
  join public.cleaning_tasks t on t.id = ca.task_id
  where t.scope = 'apartment' and ca.week_start_date >= (select d from today) - 14
  group by t.apartment_id
), prayer_stats as (
  select ws.apartment_id,
         count(*) filter (where pr.status in ('mosque', 'prayed')) as good_count,
         count(*) as total_count
  from window_students ws
  join public.prayer_records pr on pr.student_id = ws.student_id
  where pr.record_date > (select d from today) - 7
  group by ws.apartment_id
), attendance_stats as (
  select ws.apartment_id,
         count(*) filter (where ar.status in ('present', 'excused')) as good_count,
         count(*) as total_count
  from window_students ws
  join public.attendance_records ar on ar.student_id = ws.student_id
  where ar.record_date > (select d from today) - 7
  group by ws.apartment_id
), complaint_stats as (
  select c.apartment_id, count(*) as open_count
  from public.complaints c
  where c.status not in ('resolved', 'rejected') and c.apartment_id is not null
  group by c.apartment_id
)
select a.id as apartment_id,
       a.name,
       a.floor_number,
       a.supervisor_id,
       coalesce(round(100.0 * cs.done_count / nullif(cs.total_count, 0)), 100)::integer as cleaning_score,
       coalesce(round(100.0 * ps.good_count / nullif(ps.total_count, 0)), 100)::integer as prayer_score,
       coalesce(round(100.0 * ats.good_count / nullif(ats.total_count, 0)), 100)::integer as attendance_score,
       coalesce(cm.open_count, 0) as open_complaints,
       greatest(0, round(
         coalesce(round(100.0 * cs.done_count / nullif(cs.total_count, 0)), 100) * 0.35
         + coalesce(round(100.0 * ps.good_count / nullif(ps.total_count, 0)), 100) * 0.30
         + coalesce(round(100.0 * ats.good_count / nullif(ats.total_count, 0)), 100) * 0.25
         - coalesce(cm.open_count, 0) * 5
       ))::integer as overall_score
from public.apartments a
left join cleaning_stats cs on cs.apartment_id = a.id
left join prayer_stats ps on ps.apartment_id = a.id
left join attendance_stats ats on ats.apartment_id = a.id
left join complaint_stats cm on cm.apartment_id = a.id;

create or replace view public.points_leaderboard
with (security_invoker = on) as
select s.id as student_id,
       p.full_name,
       s.apartment_id,
       date_trunc('month', pe.created_at at time zone 'Europe/Istanbul')::date as month,
       sum(pe.points) as total_points
from public.points_entries pe
join public.students s on s.id = pe.student_id
join public.profiles p on p.id = s.id
group by s.id, p.full_name, s.apartment_id, date_trunc('month', pe.created_at at time zone 'Europe/Istanbul');
