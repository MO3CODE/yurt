-- =====================================================================
-- 0012 — جدولة تذكيرات الصلاة: كل دقيقة يستدعي قاعدة البيانات مسار التطبيق
--   POST /api/cron/prayer-reminders  (محمي بسرّ مشترك CRON_SECRET)
-- السرّ لا يُكتب في هذا الملف: يُخزَّن في Supabase Vault باسم cron_secret
-- (select vault.create_secret('<السر>', 'cron_secret')) ويُقرأ وقت التنفيذ.
-- يُطبَّق بعد نشر المسار وضبط CRON_SECRET في Vercel.
-- =====================================================================

select cron.unschedule(jobid) from cron.job where jobname = 'prayer-reminders';

select cron.schedule(
  'prayer-reminders',
  '* * * * *',
  $cron$
  select net.http_post(
    url := 'https://yurt-tau.vercel.app/api/cron/prayer-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
  $cron$
);
