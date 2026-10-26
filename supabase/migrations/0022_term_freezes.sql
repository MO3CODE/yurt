-- =====================================================================
-- 0022 — تجميد الترم (kayıt dondurma)
--   الطالب الذي جمّد ترماً في جامعته لا يُطلب منه فيه رفع كشف ولا تسجيل مواد،
--   ولا يُحسب في نسب الرفع والتذكيرات، ويظهر «مجمّد» للإدارة وللطالب.
-- الصلاحية: academic (والطالب يرى تجميده فقط)
-- =====================================================================

create table public.student_term_freezes (
  student_id uuid not null references public.students (id) on delete cascade,
  term_id uuid not null references public.academic_terms (id) on delete cascade,
  reason text check (char_length(reason) <= 300),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (student_id, term_id)
);
create index idx_term_freezes_term on public.student_term_freezes (term_id);

alter table public.student_term_freezes enable row level security;
create policy term_freezes_select on public.student_term_freezes for select
  using (student_id = (select auth.uid()) or (select public.has_permission('academic')));
create policy term_freezes_staff on public.student_term_freezes for all
  using ((select public.has_permission('academic')))
  with check ((select public.has_permission('academic')));

create trigger audit_log_trigger after insert or update or delete on public.student_term_freezes
  for each row execute function public.write_audit_log();
