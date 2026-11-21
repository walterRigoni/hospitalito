ALTER TABLE public.hc_tele_visits ADD CONSTRAINT hc310_visit_mode CHECK(mode IN ('telemedicine','office','home')) NOT VALID;
ALTER TABLE public.hc_tele_visits VALIDATE CONSTRAINT hc310_visit_mode;
ALTER TABLE public.hc_tele_visits DROP CONSTRAINT hc_tele_visits_mode_check;
CREATE OR REPLACE FUNCTION public.hc310_reserve_home(who text, patient text, mode_name text, at_start timestamp with time zone, duration integer, request_key uuid, visit_reason text, expected_revision integer, expected_trial boolean, home_address text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare p hc_tele_profiles;s hc_tele_settings;v hc_tele_visits;d jsonb;r jsonb;amount bigint;fee bigint;at_end timestamptz;clock time;daykey text;trial boolean;w jsonb;loc text;deposit bigint;initial_amount bigint;initial_fee bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended('hc289-provider:'||who,0));
 select * into v from hc_tele_visits where client=patient and request_id=request_key;if found then return to_jsonb(v);end if;
 select * into p from hc_tele_profiles where username=who and public_visible;
 if not found or p.revision<>expected_revision then raise exception 'El perfil cambió. Actualizá los precios y horarios';end if;
 if not exists(select 1 from hc_auth_users u where u.username=who and u.active and u.default_role=p.role) and not exists(select 1 from hc_auth_users u join hc_auth_memberships m on m.username=u.username join hc_auth_institutions i on i.id=m.institution_id where u.username=who and u.active and m.active and i.active and m.role=p.role) then raise exception 'Profesional no habilitado';end if;
 if mode_name<>'home' or not coalesce((p.modes->mode_name->>'enabled')::boolean,false) then raise exception 'Modalidad no publicada';end if;
 select * into s from hc_tele_settings where id;
 trial=not exists(select 1 from hc_tele_sellers where username=who);if trial is distinct from expected_trial then raise exception 'Cambió la condición de cobro. Actualizá el perfil';end if;
 if not trial and (not s.enabled or s.commission_bps is null or s.cancellation_policy='') then raise exception 'Los cobros todavía no están habilitados por Hospitalito';end if;
 if char_length(btrim(coalesce(home_address,''))) not between 5 and 500 then raise exception 'Indicá una dirección de domicilio válida';end if;
 daykey=extract(dow from at_start at time zone 'America/Argentina/Buenos_Aires')::integer::text;d=p.modes->mode_name->'weekly'->'days'->daykey;clock=(at_start at time zone 'America/Argentina/Buenos_Aires')::time;at_end=at_start+make_interval(mins=>duration);
 select value into w from jsonb_array_elements(coalesce(d->'windows',jsonb_build_array(jsonb_build_object('start',d->>'start','end',d->>'end','address',p.address))))
 where clock>=(value->>'start')::time and (at_end at time zone 'America/Argentina/Buenos_Aires')::time<=(value->>'end')::time
 and mod(extract(epoch from(clock-(value->>'start')::time))::integer,900)=0 limit 1;
 if duration not in(15,30,45,60) or at_start<now() or at_start>now()+interval '90 days' or not coalesce((d->>'active')::boolean,false) or w is null or (at_end at time zone 'America/Argentina/Buenos_Aires')::date<>(at_start at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'Horario fuera de la disponibilidad publicada';end if;
 loc=btrim(home_address);
 select value into r from jsonb_array_elements(p.modes->mode_name->'rates') where (value->>'minutes')::integer=duration;amount=(r->>'amount_cents')::bigint;
 if amount is null or amount<100 then raise exception 'Ese precio no está publicado';end if;
 fee=case when trial then 0 else round(amount*s.commission_bps/10000.0) end;if not trial and (fee<1 or fee>=amount) then raise exception 'Comisión incompatible con el precio';end if;
 perform hc292_assert_free(who,at_start,at_end);
 if trial then amount=0;end if;
 deposit=null;
 if deposit is not null and (deposit<1 or deposit>=amount) then raise exception 'El anticipo es incompatible con este precio. Hospitalito debe revisar el porcentaje';end if;
 initial_amount=coalesce(deposit,amount);initial_fee=case when deposit is null then fee else round(deposit*s.commission_bps/10000.0) end;
 insert into hc_tele_visits(request_id,provider,client,mode,starts_at,ends_at,minutes,total_cents,platform_cents,provider_cents,commission_bps,reason,policy_snapshot,profile_revision,is_trial,status,location_snapshot,payment_model,office_deposit_bps,deposit_cents,balance_cents) values(request_key,who,patient,mode_name,at_start,at_end,duration,amount,fee,amount-fee,case when trial then 0 else s.commission_bps end,left(visit_reason,1000),case when trial then 'Consulta de prueba gratuita, sin cobros posteriores para esta reserva.' else s.cancellation_policy end,p.revision,trial,case when trial then 'confirmed' else 'awaiting_payment' end,loc,case when deposit is null then 'split_full' else 'office_staged' end,case when deposit is null then null else s.office_deposit_bps end,deposit,case when deposit is null then null else amount-deposit end) returning * into v;
 if not trial then insert into hc_tele_payments(visit_id,kind,minutes,amount_cents,platform_cents,provider_cents,status,provider_approved) values(v.id,'initial',duration,initial_amount,initial_fee,initial_amount-initial_fee,'offered',true);end if;
 return to_jsonb(v);
end$function$

;

REVOKE ALL ON FUNCTION public.hc310_reserve_home(text,text,text,timestamptz,integer,uuid,text,integer,boolean,text) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hc310_reserve_home(text,text,text,timestamptz,integer,uuid,text,integer,boolean,text) TO service_role;
create or replace function public.hc297_available_slots(who text,mode_name text,day_date date,duration integer) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare p hc_tele_profiles;d jsonb;n integer;last_min integer;st timestamptz;en timestamptz;free boolean;out jsonb='[]';w jsonb;
begin
select * into p from hc_tele_profiles where username=who and public_visible;
if p.username is null or mode_name not in('telemedicine','office','home') or not coalesce((p.modes->mode_name->>'enabled')::boolean,false) then raise exception 'Modalidad no publicada';end if;
if day_date<current_date-1 or day_date>current_date+90 or not exists(select 1 from jsonb_array_elements(p.modes->mode_name->'rates') r where (r->>'minutes')::integer=duration) then raise exception 'Fecha o duración no disponible';end if;
d=p.modes->mode_name->'weekly'->'days'->extract(dow from day_date)::integer::text;
if not coalesce((d->>'active')::boolean,false) then return out;end if;
for w in select value from jsonb_array_elements(coalesce(d->'windows',jsonb_build_array(jsonb_build_object('start',d->>'start','end',d->>'end','address',p.address)))) loop
n=extract(hour from(w->>'start')::time)::integer*60+extract(minute from(w->>'start')::time)::integer;last_min=extract(hour from(w->>'end')::time)::integer*60+extract(minute from(w->>'end')::time)::integer;
while n+duration<=last_min loop
st=(day_date::timestamp+make_interval(mins=>n)) at time zone 'America/Argentina/Buenos_Aires';en=st+make_interval(mins=>duration);n=n+15;if st<=now() then continue;end if;
free=true;begin perform hc292_assert_free(who,st,en);exception when others then free=false;end;
out=out||jsonb_build_array(jsonb_build_object('start',st,'local',to_char(st at time zone 'America/Argentina/Buenos_Aires','YYYY-MM-DD"T"HH24:MI'),'available',free,'address',case when mode_name='office' then coalesce(w->>'address',p.address) else '' end,'location',coalesce(w->>'location',''),'latitude',w->'latitude','longitude',w->'longitude'));
end loop;end loop;return out;
end$$;

CREATE OR REPLACE FUNCTION public.hc310_notice_professional() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
 INSERT INTO hc_notifications(username,kind,title,body,payload)
 VALUES(NEW.provider,'tele_booking','Nueva solicitud de turno',
   (CASE NEW.mode WHEN 'home' THEN 'Atención a Domicilio' WHEN 'office' THEN 'Consultorio Privado' ELSE 'Telemedicina' END)||
    ' · '||to_char(NEW.starts_at at time zone 'America/Argentina/Buenos_Aires','DD/MM/YYYY HH24:MI'),
   jsonb_build_object('visitId',NEW.id,'startsAt',NEW.starts_at,'mode',NEW.mode));
 RETURN NEW;
END$$;
REVOKE ALL ON FUNCTION public.hc310_notice_professional() FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hc310_notice_professional() TO service_role;
CREATE TRIGGER hc310_notice_professional AFTER INSERT ON public.hc_tele_visits
 FOR EACH ROW EXECUTE FUNCTION public.hc310_notice_professional();
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
 'Tu turno con '||u.name||' es el '||to_char(v.starts_at at time zone 'America/Argentina/Buenos_Aires','DD/MM/YYYY HH24:MI')||' (hora de Argentina). '||case when v.mode='telemedicine' then 'Ingresá a Mis Turnos para abrir la videollamada.' when v.mode='home' then 'Atención a Domicilio. Consultá la dirección en tu reserva.' else 'Atención en consultorio particular. Consultá la dirección en tu reserva.' end,
 jsonb_build_object('visitId',v.id,'hours',r.hours,'startsAt',v.starts_at)
 from claimed r join hc_tele_visits v on v.id=r.visit_id join hc_auth_users u on u.username=v.provider;
 get diagnostics sent=row_count;
 insert into hc_notifications(id,username,kind,title,body,payload,institution_id)
 select md5('hospitalito:portal:24:'||b.id::text||':'||extract(epoch from b.starts_at)::text)::uuid,
   b.username,'portal_reminder','Recordatorio de turno · 24 horas',
   'Tu turno es el '||to_char(b.starts_at at time zone 'America/Argentina/Buenos_Aires','DD/MM/YYYY HH24:MI')||' (hora de Argentina).',
   jsonb_build_object('bookingId',b.id,'hours',24,'startsAt',b.starts_at),p.institution_id
 from hc_portal_bookings b join hc_portal_providers p on p.id=b.provider_id
 where b.status='confirmed' and b.starts_at>now() and b.starts_at-interval '24 hours'<=now()
   and b.starts_at-interval '24 hours'>now()-interval '15 minutes'
   and b.created_at<=b.starts_at-interval '24 hours'
 on conflict (id) do nothing;
 return sent;
end$$;
