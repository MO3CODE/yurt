-- =====================================================================
-- 0021 — مواد الترم لكل طالب
--   • الطالب (أو الإدارة) يسجّل مواده في الترم الحالي مع أستاذ كل مادة،
--     فتظهر المواد المشتركة بين الطلاب من بداية الترم، وتُملأ مسبقاً في كشف الدرجات
--   • الترم يُنشأ قبل تحديد فترتي الرفع (تُحدَّد لاحقاً)
-- =====================================================================

alter table public.academic_terms
  alter column midterm_from drop not null,
  alter column midterm_to drop not null,
  alter column final_from drop not null,
  alter column final_to drop not null;

create table public.student_term_courses (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  term_id uuid not null references public.academic_terms (id) on delete cascade,
  course_name text not null check (char_length(btrim(course_name)) between 2 and 120),
  course_code text check (char_length(course_code) <= 20),
  instructor text check (char_length(instructor) <= 80),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index uq_term_course on public.student_term_courses (student_id, term_id, lower(btrim(course_name)));
create index idx_term_courses_term on public.student_term_courses (term_id);

alter table public.student_term_courses enable row level security;

create policy term_courses_select on public.student_term_courses for select
  using (student_id = (select auth.uid()) or (select public.has_permission('academic')));
create policy term_courses_staff on public.student_term_courses for all
  using ((select public.has_permission('academic')))
  with check ((select public.has_permission('academic')));
-- الطالب يضيف مواده ويحذفها بنفسه
create policy term_courses_own_insert on public.student_term_courses for insert
  with check (student_id = (select auth.uid()));
create policy term_courses_own_delete on public.student_term_courses for delete
  using (student_id = (select auth.uid()));

create trigger audit_log_trigger after insert or update or delete on public.student_term_courses
  for each row execute function public.write_audit_log();
