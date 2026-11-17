create or replace function public.hc296_send_reminders() returns integer
 language plpgsql security invoker set search_path=public,pg_temp as $$
declare sent integer;
begin
 with due as (
 select v.id,v.starts_at,h.hours from hc_tele_visits v cross join (values(24),(12))h(hours)
 where v.status='confirmed' and v.starts_at>now()
 and v.starts_at-make_interval(hours=>h.hours)<=now()
 and v.starts_at-make_interval(hours=>h.hours)>=v.created_at
 and v.starts_at-make_interval(hours=>h.hours)>now()-interval '15 minutes'
 ), claimed as (
 insert into hc_tele_reminders(visit_id,starts_at,hours) select id,starts_at,hours from due
 on conflict(visit_id,starts_at,hours) do nothing returning *
 )
 insert into hc_notifications(id,username,kind,title,body,payload)
 select r.notification_id,v.client,'tele_reminder','Recordatorio de turno · '||r.hours::text||' horas',
 'Tu turno con '||u.name||' es el '||to_char(v.starts_at at time zone 'America/Argentina/Buenos_Aires','DD/MM/YYYY HH24:MI')||' (hora de Argentina). '||case when v.mode='telemedicine' then 'Ingresá a Mis consultas para abrir la videollamada.' else 'Atención en consultorio particular. Consultá la dirección en tu reserva.' end,
 jsonb_build_object('visitId',v.id,'hours',r.hours,'startsAt',v.starts_at)
 from claimed r join hc_tele_visits v on v.id=r.visit_id join hc_auth_users u on u.username=v.provider;
 get diagnostics sent=row_count;return sent;
end$$;
