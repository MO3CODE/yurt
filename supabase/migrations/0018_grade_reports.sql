-- ============================================================================
-- كشوف الدرجات: الإدارة تفتح فترتي رفع (النصفي والنهائي) لكل ترم،
-- والطالب يرفع ملفه (PDF أو صور) ويكتب معدله، والإدارة تؤكّد فيتحدّث معدله في المتابعة
-- الصلاحية: academic
-- ============================================================================

create table public.academic_terms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  midterm_from date not null,
  midterm_to date not null,
  final_from date not null,
  final_to date not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (midterm_to >= midterm_from and final_to >= final_from and final_from >= midterm_from)
);

create table public.grade_reports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  term_id uuid not null references public.academic_terms (id) on delete cascade,
  kind text not null check (kind in ('midterm', 'final')),
  file_paths text[] not null check (cardinality(file_paths) between 1 and 5),
  -- ما كتبه الطالب (للنهائي)، على مقياس ٤
  term_gpa numeric(3, 2) check (term_gpa between 0 and 4),
  cumulative_gpa numeric(3, 2) check (cumulative_gpa between 0 and 4),
  note text check (char_length(note) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'reviewed')),
  -- ما أكّدته الإدارة بعد مراجعة الملف
  verified_term_gpa numeric(3, 2) check (verified_term_gpa between 0 and 4),
  verified_cumulative_gpa numeric(3, 2) check (verified_cumulative_gpa between 0 and 4),
  admin_note text check (char_length(admin_note) <= 2000),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, term_id, kind)
);
create index idx_grade_reports_term on public.grade_reports (term_id, kind);

alter table public.academic_terms enable row level security;
alter table public.grade_reports enable row level security;

create policy academic_terms_read on public.academic_terms for select
  using ((select auth.uid()) is not null);
create policy academic_terms_write on public.academic_terms for all
  using ((select public.has_permission('academic')))
  with check ((select public.has_permission('academic')));

create policy grade_reports_select on public.grade_reports for select
  using (student_id = (select auth.uid()) or (select public.has_permission('academic')));
create policy grade_reports_insert_own on public.grade_reports for insert
  with check (student_id = (select auth.uid()) and status = 'pending' and reviewed_by is null and verified_cumulative_gpa is null);
-- الطالب يبدّل ملفه أو معدله ما دامت الإدارة لم تراجع
create policy grade_reports_update_own_pending on public.grade_reports for update
  using (student_id = (select auth.uid()) and status = 'pending')
  with check (student_id = (select auth.uid()) and status = 'pending' and reviewed_by is null and verified_cumulative_gpa is null);

-- ملفات الكشوف: مخزن خاص، كل طالب في مجلد باسم معرّفه
insert into storage.buckets (id, name, public) values ('grade-reports', 'grade-reports', false)
on conflict (id) do nothing;

create policy grade_reports_files_insert_own on storage.objects for insert
  with check (bucket_id = 'grade-reports' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy grade_reports_files_read on storage.objects for select
  using (
    bucket_id = 'grade-reports'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.has_permission('academic')))
  );
create policy grade_reports_files_delete_own on storage.objects for delete
  using (bucket_id = 'grade-reports' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- مراجعة الإدارة: تؤكّد المعدل (أو تصحّحه) فيتحدّث معدل الطالب في المتابعة الأكاديمية، ويصله إشعار
create or replace function public.review_grade_report(
  p_id uuid, p_term_gpa numeric, p_cumulative_gpa numeric, p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rep public.grade_reports;
  term_name text;
begin
  if not public.has_permission('academic') then
    raise exception 'لا تملك صلاحية المتابعة الأكاديمية';
  end if;
  if (p_term_gpa is not null and (p_term_gpa < 0 or p_term_gpa > 4))
     or (p_cumulative_gpa is not null and (p_cumulative_gpa < 0 or p_cumulative_gpa > 4)) then
    raise exception 'المعدل بين ٠ و٤';
  end if;

  update public.grade_reports
  set status = 'reviewed',
      verified_term_gpa = p_term_gpa,
      verified_cumulative_gpa = p_cumulative_gpa,
      admin_note = nullif(btrim(p_note), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where id = p_id
  returning * into rep;
  if rep.id is null then raise exception 'الكشف غير موجود'; end if;

  if p_cumulative_gpa is not null then
    insert into public.student_academic_profiles as sap (student_id, gpa, gpa_scale)
    values (rep.student_id, p_cumulative_gpa, 4)
    on conflict (student_id) do update set gpa = excluded.gpa, gpa_scale = 4;
  end if;

  select name into term_name from public.academic_terms where id = rep.term_id;
  insert into public.notifications (title, body, target_type, target_student_id, created_by)
  values (
    'رُوجع كشف درجاتك ✓',
    term_name || ' — ' || case when rep.kind = 'midterm' then 'النصفي' else 'النهائي' end
      || coalesce(' — ' || left(nullif(btrim(p_note), ''), 140), ''),
    'student', rep.student_id, auth.uid()
  );
end;
$$;

revoke execute on function public.review_grade_report(uuid, numeric, numeric, text) from public, anon;
grant execute on function public.review_grade_report(uuid, numeric, numeric, text) to authenticated;
