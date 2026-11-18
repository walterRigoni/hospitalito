begin;
insert into hc_auth_users(username,name,default_role) values('test-v299-pro','FICTICIO','medico');
insert into hc_tele_profiles(username,role,specialty,credential,public_visible,modes)
select 'test-v299-pro','medico','Cardiología','FICTICIA',true,jsonb_build_object('office',jsonb_build_object('enabled',true,'weekly',jsonb_build_object('days',(select jsonb_object_agg(i::text,jsonb_build_object('active',true,'windows','[{"start":"08:00","end":"12:00","address":"SEDE A","latitude":-31.4,"longitude":-64.2},{"start":"14:00","end":"18:00","address":"SEDE B","latitude":0,"longitude":0}]'::jsonb)) from generate_series(0,6)i)),'rates','[{"minutes":15,"amount_cents":200000}]'::jsonb));
do $$declare slots jsonb;begin
slots=hc297_available_slots('test-v299-pro','office',current_date+2,15);
if not exists(select 1 from jsonb_array_elements(slots)s where s->>'address'='SEDE A' and (s->>'latitude')::numeric=-31.4 and (s->>'longitude')::numeric=-64.2) then raise exception 'GPS of first office lost';end if;
if not exists(select 1 from jsonb_array_elements(slots)s where s->>'address'='SEDE B' and (s->>'latitude')::numeric=0 and (s->>'longitude')::numeric=0) then raise exception 'Zero coordinates lost';end if;
if has_function_privilege('anon','public.hc297_available_slots(text,text,date,integer)','execute') then raise exception 'Anonymous direct RPC exposed';end if;
end$$;
rollback;
select 'PASS: real slot function preserves each office GPS point, including zero, and RPC grants remain restricted. All fictitious records rolled back.' as result;
