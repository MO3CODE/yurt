-- ============================================================================
-- إصلاح أمني: الـ views كانت تعمل بصلاحيات مالكها (تتجاوز RLS) بشكل افتراضي.
-- security_invoker يجعلها تحترم صلاحيات المستخدم الذي يستعلم فعلياً.
-- ============================================================================

alter view public.apartment_health set (security_invoker = on);
alter view public.points_leaderboard set (security_invoker = on);
alter view public.student_profile_summary set (security_invoker = on);
