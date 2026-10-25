-- =====================================================================
-- 0020 — استيراد نتائج الترمات السابقة + متابعة طلاب اللغة
--   • ترم «أرشيفي»: نتائجه مستوردة من تقرير، فلا يُطلب من الطلاب رفع كشف فيه
--   • حالة الترم تحفظ عدد المواد والناجح والراسب (التقارير لا تذكر الساعات)
--   • متابعة سنة اللغة: المستويات المجتازة، المستوى الحالي، الحالة، موعد الامتحان
-- الصلاحية: academic (والطالب يرى ما يخصه فقط)
-- =====================================================================

alter table public.academic_terms
  add column historical boolean not null default false;

-- حالة الترم من تقرير: الساعات غير معروفة (null) فلا يُطبَّق شرط العبء الدراسي
alter table public.academic_standings
  alter column term_credits drop not null,
  alter column term_credits drop default,
  add column courses_count integer check (courses_count between 0 and 30),
  add column passed_count integer check (passed_count between 0 and 30),
  add column failed_count integer check (failed_count between 0 and 30),
  add column source text not null default 'report' check (source in ('report', 'import'));

-- ---------------------------------------------------------------------
-- متابعة سنة اللغة (طالب واحد = صف واحد)
-- ---------------------------------------------------------------------
create table public.student_language_progress (
  student_id uuid primary key references public.students (id) on delete cascade,
  levels_passed text[] not null default '{}',
  current_level text check (char_length(current_level) <= 20),
  status text not null default 'studying'
    check (status in ('studying', 'awaiting_result', 'final_exam_prep', 'last_chance', 'completed')),
  next_exam_at date,
  notes text check (char_length(notes) <= 1000),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.student_language_progress enable row level security;
create policy language_progress_select on public.student_language_progress for select
  using (student_id = (select auth.uid()) or (select public.has_permission('academic')));
create policy language_progress_staff on public.student_language_progress for all
  using ((select public.has_permission('academic')))
  with check ((select public.has_permission('academic')));

create trigger touch_updated_at before update on public.student_language_progress
  for each row execute function public.touch_updated_at();
create trigger audit_log_trigger after insert or update or delete on public.student_language_progress
  for each row execute function public.write_audit_log();
