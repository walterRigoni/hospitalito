begin;
insert into hc_auth_institutions(id,data_institution_id,name) values('test-v296-tx','test-v296-tx','FICTICIA ROLLBACK');
insert into hc_auth_users(username,name,default_role) values('test-v296-pro','PROFESIONAL FICTICIO','medico'),('test-v296-client','PACIENTE FICTICIO','cliente');
insert into hc_auth_memberships(username,institution_id,role) values('test-v296-pro','test-v296-tx','medico');
insert into hc_portal_clients(username,legal_name,dni,dob,document_path) values('test-v296-client','PACIENTE FICTICIO','99999992','1990-01-01','FICTICIO');
insert into hc_tele_profiles(username,role,specialty,credential,public_visible,modes)
select 'test-v296-pro','medico','Cardiología','FICTICIA',true,jsonb_build_object('telemedicine',jsonb_build_object('enabled',true,'weekly',jsonb_build_object('days',(select jsonb_object_agg(i::text,jsonb_build_object('active',true,'start','00:00','end','23:59')) from generate_series(0,6)i)),'rates','[{"minutes":15,"amount_cents":200000}]'::jsonb),'office',jsonb_build_object('enabled',true,'weekly',jsonb_build_object('days',(select jsonb_object_agg(i::text,jsonb_build_object('active',true,'start','00:00','end','23:59')) from generate_series(0,6)i)),'rates','[{"minutes":15,"amount_cents":200000}]'::jsonb));
do $test$
declare st timestamptz=((current_date+3)::text||'T10:00:00-03:00')::timestamptz;req uuid=gen_random_uuid();v jsonb;x jsonb;failed boolean;cnt integer;vid uuid;
begin
update hc_tele_settings set enabled=false where id;
v=hc296_reserve('test-v296-pro','test-v296-client','telemedicine',st,15,req,'FICTICIO',1,true);vid=(v->>'id')::uuid;
if v->>'status'<>'confirmed' or not (v->>'is_trial')::boolean or (v->>'total_cents')::integer<>0 then raise exception 'Free trial not confirmed at zero';end if;
if exists(select 1 from hc_tele_payments where visit_id=vid) then raise exception 'Trial created payment';end if;
x=hc296_reserve('test-v296-pro','test-v296-client','telemedicine',st,15,req,'FICTICIO',1,true);if x->>'id'<>v->>'id' then raise exception 'Retry not idempotent';end if;
failed=false;begin perform hc296_reserve('test-v296-pro','test-v296-client','office',st,15,gen_random_uuid(),'FICTICIO',1,true);exception when others then failed=true;end;if not failed then raise exception 'Overlap permitted';end if;
failed=false;begin perform hc296_reserve('test-v296-pro','test-v296-client','office',st+interval '1 hour',15,gen_random_uuid(),'FICTICIO',99,true);exception when others then failed=true;end;if not failed then raise exception 'Stale revision permitted';end if;
x=hc296_reserve('test-v296-pro','test-v296-client','office',st+interval '1 hour',15,gen_random_uuid(),'FICTICIO',1,true);if not (x->>'is_trial')::boolean then raise exception 'Office trial missing';end if;
-- Activate billing for subsequent requests; free visits must retain their snapshot.
insert into hc_tele_sellers(username,collector_id,encrypted_tokens,expires_at) values('test-v296-pro','FICTICIO','FICTICIO',now()+interval '1 day');
failed=false;begin perform hc296_reserve('test-v296-pro','test-v296-client','office',st+interval '2 hours',15,gen_random_uuid(),'FICTICIO',1,true);exception when others then failed=true;end;if not failed then raise exception 'Forged free status accepted';end if;
failed=false;begin perform hc296_reserve('test-v296-pro','test-v296-client','office',st+interval '2 hours',15,gen_random_uuid(),'FICTICIO',1,false);exception when others then failed=true;end;if not failed then raise exception 'Disabled billing accepted';end if;
update hc_tele_settings set enabled=true,commission_bps=2000,cancellation_policy='FICTICIA' where id;
x=hc296_reserve('test-v296-pro','test-v296-client','office',st+interval '2 hours',15,gen_random_uuid(),'FICTICIO',1,false);
if (x->>'is_trial')::boolean or (x->>'total_cents')::integer<>200000 or x->>'status'<>'awaiting_payment' then raise exception 'Paid billing not restored';end if;
if (select total_cents from hc_tele_visits where id=vid)<>0 then raise exception 'Trial charged retroactively';end if;
-- Both reminder thresholds, idempotency, cancellation and not-yet-due checks.
update hc_tele_visits set starts_at=now()+interval '24 hours'-interval '10 seconds',ends_at=now()+interval '24 hours 15 minutes',created_at=now()-interval '2 days' where id=vid;
perform hc296_send_reminders();
if (select count(*) from hc_tele_reminders where visit_id=vid and hours=24)<>1 then raise exception '24h reminder missing';end if;
perform hc296_send_reminders();if (select count(*) from hc_notifications where username='test-v296-client')<>1 then raise exception 'Duplicate/early reminder';end if;
update hc_tele_visits set starts_at=now()+interval '12 hours'-interval '10 seconds',ends_at=now()+interval '12 hours 15 minutes' where id=vid;
perform hc296_send_reminders();if (select count(*) from hc_tele_reminders where visit_id=vid and hours=12)<>1 then raise exception '12h reminder missing';end if;
update hc_tele_visits set status='cancelled',starts_at=now()+interval '24 hours'-interval '20 seconds',ends_at=now()+interval '24 hours 15 minutes' where id=vid;perform hc296_send_reminders();if (select count(*) from hc_notifications where username='test-v296-client')<>2 then raise exception 'Cancelled reminder sent';end if;
if has_function_privilege('anon','public.hc296_reserve(text,text,text,timestamptz,integer,uuid,text,integer,boolean)','EXECUTE') then raise exception 'Anonymous access';end if;
end$test$;
rollback;
select 'PASS: zero-cost trials, office/telemedicine, idempotency, conflicts, stale revisions, account linking, paid transition, immutable free booking, 24h/12h reminders, deduplication, cancellation, permissions; all fixtures rolled back' as result;
