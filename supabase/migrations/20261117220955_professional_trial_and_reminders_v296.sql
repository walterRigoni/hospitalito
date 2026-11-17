begin;
alter table public.hc_tele_visits add column if not exists is_trial boolean not null default false;
alter table public.hc_tele_visits drop constraint hc_tele_visits_total_cents_check;
alter table public.hc_tele_visits drop constraint hc_tele_visits_platform_cents_check;
alter table public.hc_tele_visits drop constraint hc_tele_visits_commission_bps_check;
alter table public.hc_tele_visits add constraint hc296_visit_money check (
 (is_trial and total_cents=0 and platform_cents=0 and provider_cents=0 and commission_bps=0) or
 (not is_trial and total_cents>0 and platform_cents>0 and commission_bps between 1 and 9999 and total_cents=platform_cents+provider_cents));
create or replace function public.hc296_reserve(who text,patient text,mode_name text,at_start timestamptz,duration integer,request_key uuid,visit_reason text,expected_revision integer,expected_trial boolean) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare p hc_tele_profiles;s hc_tele_settings;v hc_tele_visits;d jsonb;r jsonb;amount bigint;fee bigint;at_end timestamptz;clock time;daykey text;trial boolean;
begin
 perform pg_advisory_xact_lock(hashtextextended('hc289-provider:'||who,0));
 select * into v from hc_tele_visits where client=patient and request_id=request_key;if found then return to_jsonb(v);end if;
 select * into p from hc_tele_profiles where username=who and public_visible;
 if not found or p.revision<>expected_revision then raise exception 'El perfil cambió. Actualizá los precios y horarios';end if;
 if not exists(select 1 from hc_auth_users u join hc_auth_memberships m on m.username=u.username join hc_auth_institutions i on i.id=m.institution_id where u.username=who and u.active and m.active and i.active and m.role=p.role) then raise exception 'Profesional no habilitado';end if;
 if mode_name not in('telemedicine','office') or not coalesce((p.modes->mode_name->>'enabled')::boolean,false) then raise exception 'Modalidad no publicada';end if;
 trial=not exists(select 1 from hc_tele_sellers where username=who);
 if trial is distinct from expected_trial then raise exception 'Cambió la condición de cobro. Actualizá el perfil antes de reservar';end if;
 if not trial then return hc292_reserve(who,patient,mode_name,at_start,duration,request_key,visit_reason,expected_revision);end if;
 daykey=extract(dow from at_start at time zone 'America/Argentina/Buenos_Aires')::integer::text;d=p.modes->mode_name->'weekly'->'days'->daykey;clock=(at_start at time zone 'America/Argentina/Buenos_Aires')::time;at_end=at_start+make_interval(mins=>duration);
 if duration not in(15,30,45,60) or at_start<now() or at_start>now()+interval '90 days' or not coalesce((d->>'active')::boolean,false) or clock<(d->>'start')::time or (at_end at time zone 'America/Argentina/Buenos_Aires')::date<>(at_start at time zone 'America/Argentina/Buenos_Aires')::date or (at_end at time zone 'America/Argentina/Buenos_Aires')::time>(d->>'end')::time or mod(extract(epoch from(clock-(d->>'start')::time))::integer,900)<>0 then raise exception 'Horario fuera de la disponibilidad publicada';end if;
 select value into r from jsonb_array_elements(p.modes->mode_name->'rates') where (value->>'minutes')::integer=duration;amount=(r->>'amount_cents')::bigint;
 if amount is null or amount<100 then raise exception 'Ese precio no está publicado';end if;
 perform hc292_assert_free(who,at_start,at_end);
 insert into hc_tele_visits(request_id,provider,client,mode,starts_at,ends_at,minutes,total_cents,platform_cents,provider_cents,commission_bps,reason,policy_snapshot,profile_revision,status,is_trial)
 values(request_key,who,patient,mode_name,at_start,at_end,duration,0,0,0,0,left(visit_reason,1000),'Consulta de prueba gratuita. No se solicitará ningún pago para esta reserva.',p.revision,'confirmed',true) returning * into v;
 return to_jsonb(v);
end$$;

revoke all on function public.hc296_reserve(text,text,text,timestamptz,integer,uuid,text,integer,boolean) from public,anon,authenticated;
grant execute on function public.hc296_reserve(text,text,text,timestamptz,integer,uuid,text,integer,boolean) to service_role;
-- Each reminder has a stable notification UUID, deduplicated even on concurrent runs.
create table public.hc_tele_reminders(
 visit_id uuid not null references public.hc_tele_visits(id) on delete cascade,
 starts_at timestamptz not null,hours integer not null check(hours in(12,24)),
 notification_id uuid not null default gen_random_uuid(),created_at timestamptz not null default now(),
 primary key(visit_id,starts_at,hours),unique(notification_id)
);
alter table public.hc_tele_reminders enable row level security;
revoke all on public.hc_tele_reminders from public,anon,authenticated;
grant all on public.hc_tele_reminders to service_role;
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
revoke all on function public.hc296_send_reminders() from public,anon,authenticated;
grant execute on function public.hc296_send_reminders() to service_role;
create extension if not exists pg_cron;
select cron.schedule('hospitalito-tele-reminders','* * * * *','select public.hc296_send_reminders();');
commit;
