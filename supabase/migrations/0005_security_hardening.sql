-- =====================================================================
-- 0005 — تقوية الأمان والأداء
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) الدور يُقرأ من app_metadata (يضبطه السيرفر فقط) بدل user_metadata
--    (user_metadata يتحكم فيه المستخدم عند التسجيل → كان يسمح بانتحال super_admin)
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_role app_role := coalesce((new.raw_app_meta_data ->> 'role')::app_role, 'student');
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email), new_role);

  if new_role = 'student' then
    insert into public.students (id) values (new.id);
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 2) منع أي مستخدم من ترقية نفسه (role / صلاحيات manage_*)
-- ---------------------------------------------------------------------
create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- السيرفر (service role) أو المدير العام: مسموح
  if auth.uid() is null or public.is_super_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role <> 'student' or new.manage_academic or new.manage_religious
       or new.manage_facilities or new.manage_reports then
      raise exception 'غير مسموح بتعيين الصلاحيات';
    end if;
  elsif new.role is distinct from old.role
     or new.manage_academic is distinct from old.manage_academic
     or new.manage_religious is distinct from old.manage_religious
     or new.manage_facilities is distinct from old.manage_facilities
     or new.manage_reports is distinct from old.manage_reports then
    raise exception 'غير مسموح بتعديل الصلاحيات';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_privileged_columns on public.profiles;
create trigger guard_profile_privileged_columns
  before insert or update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();

-- ---------------------------------------------------------------------
-- 3) الحضور: الطالب يسجّل حضوره الذاتي فقط، ولا يعدّل سجلاً اعتمده المشرف
-- ---------------------------------------------------------------------
create or replace function public.guard_attendance_self_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() or public.supervises_student(new.student_id) then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.source <> 'self' then
    raise exception 'سجل الحضور لهذا اليوم معتمد من المشرف ولا يمكن تعديله';
  end if;

  new.source := 'self';
  new.approved_by := null;
  new.recorded_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists guard_attendance_self_write on public.attendance_records;
create trigger guard_attendance_self_write
  before insert or update on public.attendance_records
  for each row execute function public.guard_attendance_self_write();

-- ---------------------------------------------------------------------
-- 4) تضييق السياسات: الطالب لا يعدّل حالة شكواه/طلبه/مهام النظافة/بيانات منحته
-- ---------------------------------------------------------------------
drop policy if exists students_self_update on public.students;

drop policy if exists complaints_update on public.complaints;
create policy complaints_update on public.complaints for update
  using (public.is_admin() or public.is_apartment_supervisor(apartment_id));

drop policy if exists complaints_insert on public.complaints;
create policy complaints_insert on public.complaints for insert
  with check (
    public.is_admin()
    or (
      student_id = (select auth.uid())
      and status = 'new'
      and supervisor_response is null
      and admin_response is null
      and apartment_id is not distinct from (select s.apartment_id from public.students s where s.id = (select auth.uid()))
    )
  );

drop policy if exists academic_support_update on public.academic_support_requests;
create policy academic_support_update on public.academic_support_requests for update
  using (public.is_admin());

drop policy if exists academic_support_insert on public.academic_support_requests;
create policy academic_support_insert on public.academic_support_requests for insert
  with check (
    public.is_admin()
    or (
      student_id = (select auth.uid())
      and status = 'open'
      and assigned_to_profile_id is null
      and assigned_to_name is null
      and admin_notes is null
    )
  );

drop policy if exists cleaning_assignments_write on public.cleaning_assignments;
create policy cleaning_assignments_write on public.cleaning_assignments for all
  using (
    public.is_admin()
    or exists (select 1 from public.cleaning_tasks t where t.id = task_id and public.is_apartment_supervisor(t.apartment_id))
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.cleaning_tasks t where t.id = task_id and public.is_apartment_supervisor(t.apartment_id))
  );

-- المشرف يرى أسماء طلاب شقته (كان يرى معرّفات فقط)
drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin on public.profiles for select
  using (
    id = (select auth.uid())
    or public.is_admin()
    or public.supervises_student(id)
    or id in (select a.supervisor_id from public.apartments a where a.supervisor_id is not null)
  );

drop policy if exists profiles_admin_insert on public.profiles;
create policy profiles_admin_insert on public.profiles for insert
  with check (public.is_admin() or (id = (select auth.uid()) and role = 'student'));

-- ---------------------------------------------------------------------
-- 5) أداء RLS: auth.uid() / is_admin() تُحسب مرة واحدة لكل استعلام بدل كل صف
-- ---------------------------------------------------------------------
do $$
declare
  p record;
  new_qual text;
  new_check text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
  loop
    new_qual := p.qual;
    new_check := p.with_check;

    if new_qual is not null and new_qual not like '%SELECT auth.uid()%' then
      new_qual := replace(new_qual, 'auth.uid()', '(select auth.uid())');
    end if;
    if new_check is not null and new_check not like '%SELECT auth.uid()%' then
      new_check := replace(new_check, 'auth.uid()', '(select auth.uid())');
    end if;
    new_qual := regexp_replace(new_qual, '(?<!select )is_admin\(\)', '(select is_admin())', 'gi');
    new_check := regexp_replace(new_check, '(?<!select )is_admin\(\)', '(select is_admin())', 'gi');

    if new_qual is distinct from p.qual then
      execute format('alter policy %I on %I.%I using (%s)', p.policyname, p.schemaname, p.tablename, new_qual);
    end if;
    if new_check is distinct from p.with_check then
      execute format('alter policy %I on %I.%I with check (%s)', p.policyname, p.schemaname, p.tablename, new_check);
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 6) دوال SECURITY DEFINER: لا تُستدعى من الزوار غير المسجّلين
-- ---------------------------------------------------------------------
revoke execute on function
  public.is_admin(),
  public.is_super_admin(),
  public."current_role"(),
  public.is_apartment_supervisor(uuid),
  public.supervises_student(uuid),
  public.supervised_apartment_id()
from public, anon;

grant execute on function
  public.is_admin(),
  public.is_super_admin(),
  public."current_role"(),
  public.is_apartment_supervisor(uuid),
  public.supervises_student(uuid),
  public.supervised_apartment_id()
to authenticated, service_role;

-- دوال الـ triggers لا تُستدعى عبر الـ API إطلاقاً
revoke execute on function
  public.handle_new_user(),
  public.guard_profile_privileged_columns(),
  public.guard_attendance_self_write()
from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 7) فهارس للمفاتيح الأجنبية
-- ---------------------------------------------------------------------
create index if not exists idx_academic_support_student on public.academic_support_requests (student_id);
create index if not exists idx_academic_support_assigned on public.academic_support_requests (assigned_to_profile_id);
create index if not exists idx_alerts_student on public.alerts (student_id);
create index if not exists idx_alerts_apartment on public.alerts (apartment_id);
create index if not exists idx_alerts_resolved_by on public.alerts (resolved_by);
create index if not exists idx_apartments_supervisor on public.apartments (supervisor_id);
create index if not exists idx_attendance_approved_by on public.attendance_records (approved_by);
create index if not exists idx_attendance_recorded_by on public.attendance_records (recorded_by);
create index if not exists idx_schedule_student on public.class_schedule_entries (student_id);
create index if not exists idx_cleaning_assignments_student on public.cleaning_assignments (student_id);
create index if not exists idx_cleaning_assignments_verified_by on public.cleaning_assignments (verified_by);
create index if not exists idx_cleaning_tasks_apartment on public.cleaning_tasks (apartment_id);
create index if not exists idx_cleaning_tasks_facility on public.cleaning_tasks (facility_id);
create index if not exists idx_complaints_student on public.complaints (student_id);
create index if not exists idx_facility_issues_facility on public.facility_issues (facility_id);
create index if not exists idx_facility_issues_reported_by on public.facility_issues (reported_by);
create index if not exists idx_generated_reports_by on public.generated_reports (generated_by);
create index if not exists idx_health_student on public.health_records (student_id);
create index if not exists idx_health_reported_by on public.health_records (reported_by);
create index if not exists idx_notification_reads_profile on public.notification_reads (profile_id);
create index if not exists idx_notifications_created_by on public.notifications (created_by);
create index if not exists idx_notifications_target_student on public.notifications (target_student_id);
create index if not exists idx_points_created_by on public.points_entries (created_by);
create index if not exists idx_push_subscriptions_profile on public.push_subscriptions (profile_id);
create index if not exists idx_tasks_student on public.tasks (student_id);
