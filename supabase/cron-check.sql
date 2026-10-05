-- =============================================================
--  Проверка расписания серверных напоминаний
--
--  Выполнять в Supabase → SQL Editor после supabase/cron.sql.
--  Секретов здесь нет, файл можно держать в git.
-- =============================================================

-- 1. Задание на месте?
--    Ожидаем: sebason-push | */10 * * * * | active = true
select jobname, schedule, active
  from cron.job
 where jobname = 'sebason-push';

-- 2. Запуски за последний час.
--    Ожидаем: status = succeeded. Пусто — десять минут ещё не прошло.
--    failed — смотреть return_message: чаще всего 401 (разошёлся CRON_SECRET)
--    или 404 (функция не развёрнута).
select status, return_message, start_time
  from cron.job_run_details
 where jobid = (select jobid from cron.job where jobname = 'sebason-push')
   and start_time > now() - interval '1 hour'
 order by start_time desc
 limit 10;

-- 3. Подписки устройств. Пусто — телефон не подписан:
--    в приложении выключить и включить тумблер уведомлений.
select left(endpoint, 40) || '…' as endpoint,
       timezone,
       locale,
       last_seen_at
  from public.push_subscriptions
 order by last_seen_at desc;

-- 4. Что уже отправлено за сутки. Пусто при живом задании — просто не было
--    повода: пока малыш спит и до сна далеко, слать нечего.
select kind, key, sent_at
  from public.push_log
 where sent_at > now() - interval '1 day'
 order by sent_at desc
 limit 20;

-- 5. Что ответила функция. cron.job_run_details показывает только, что SQL
--    выполнился: pg_net шлёт запрос асинхронно, и 401 выглядит так же успешно.
--    Ожидаем: status_code = 200.
select status_code, timed_out, error_msg, created
  from net._http_response
 order by created desc
 limit 5;

-- 6. Почему функция ничего не шлёт.
--    Подписки без family_id она пропускает (if (!item.family_id) continue),
--    и такое устройство для неё не существует. Ожидаем family_id не null.
select left(endpoint, 30) || '…' as endpoint, family_id, last_seen_at
  from public.push_subscriptions
 order by last_seen_at desc;

-- 7. Условия напоминаний: без bedtime не придёт «пора укладываться»,
--    а при выключенных флагах — вообще ничего.
select name, family_id, bedtime, notify_bedtime, notify_wake_window
  from public.children
 where deleted = false;
