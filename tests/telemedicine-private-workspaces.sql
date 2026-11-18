begin;
insert into hc_auth_users(username,name,default_role) values('test-v297-pro','PROFESIONAL FICTICIO','medico'),('test-v297-other','OTRO PROFESIONAL','medico'),('test-v297-client','PACIENTE FICTICIO','cliente');
insert into hc_portal_clients(username,legal_name,dni,dob,document_path) values('test-v297-client','PACIENTE FICTICIO','99999993','1990-01-01','FICTICIO');
insert into hc_tele_profiles(username,role,specialty,credential,public_visible,modes)
select 'test-v297-pro','medico','Cardiología','FICTICIA',true,jsonb_build_object('office',jsonb_build_object('enabled',true,'weekly',jsonb_build_object('days',(select jsonb_object_agg(i::text,jsonb_build_object('active',true,'start','08:00','end','18:00','windows','[{"start":"08:00","end":"12:00","address":"Dirección A","location":"Sede A"},{"start":"14:00","end":"18:00","address":"Dirección B","location":"Sede B"}]'::jsonb)) from generate_series(0,6)i)),'rates','[{"minutes":15,"amount_cents":200000}]'::jsonb));
do $test$
declare st timestamptz=((current_date+3)::text||'T09:00:00-03:00')::timestamptz;v jsonb;b jsonb;n jsonb;failed boolean;slots jsonb;cnt integer;
begin
update hc_tele_settings set enabled=false where id;
v=hc297_reserve('test-v297-pro','test-v297-client','office',st,15,gen_random_uuid(),'FICTICIO',1,true);
if v->>'location_snapshot'<>'Dirección A' or not (v->>'is_trial')::boolean then raise exception 'Morning location or independent trial failed';end if;
b=hc297_reserve('test-v297-pro','test-v297-client','office',st+interval '6 hours',15,gen_random_uuid(),'FICTICIO',1,true);
if b->>'location_snapshot'<>'Dirección B' then raise exception 'Afternoon location incorrect';end if;
failed=false;begin perform hc297_reserve('test-v297-pro','test-v297-client','office',st+interval '4 hours',15,gen_random_uuid(),'FICTICIO',1,true);exception when others then failed=true;end;if not failed then raise exception 'Gap reserved';end if;
failed=false;begin perform hc297_reserve('test-v297-pro','test-v297-client','office',st,15,gen_random_uuid(),'FICTICIO',1,true);exception when others then failed=true;end;if not failed then raise exception 'Double booking';end if;
slots=hc297_available_slots('test-v297-pro','office',(st at time zone 'America/Argentina/Buenos_Aires')::date,15);
if not exists(select 1 from jsonb_array_elements(slots)s where s->>'address'='Dirección A') or not exists(select 1 from jsonb_array_elements(slots)s where s->>'address'='Dirección B') then raise exception 'Slot location missing';end if;
if exists(select 1 from jsonb_array_elements(slots)s where right(s->>'local',5)='13:00') then raise exception 'Gap exposed';end if;
update hc_tele_profiles set address='NUEVA DIRECCIÓN',revision=2 where username='test-v297-pro';
if (select location_snapshot from hc_tele_visits where id=(v->>'id')::uuid)<>'Dirección A' then raise exception 'Location snapshot changed';end if;
n=hc297_save_note('test-v297-pro',(v->>'id')::uuid,0,'{"subjective":"Motivo ficticio","assessment":"Evaluación ficticia"}');if (n->>'revision')::integer<>1 then raise exception 'Initial note revision';end if;
n=hc297_save_note('test-v297-pro',(v->>'id')::uuid,1,'{"subjective":"Segunda revisión ficticia"}');if (n->>'revision')::integer<>2 then raise exception 'Updated note revision';end if;
if (select count(*) from hc_tele_note_versions where visit_id=(v->>'id')::uuid)<>2 then raise exception 'Clinical audit versions missing';end if;
failed=false;begin perform hc297_save_note('test-v297-other',(v->>'id')::uuid,2,'{}');exception when others then failed=true;end;if not failed then raise exception 'Wrong doctor could write';end if;
failed=false;begin perform hc297_save_note('test-v297-pro',(v->>'id')::uuid,1,'{}');exception when others then failed=true;end;if not failed then raise exception 'Stale note overwrite';end if;
insert into hc_tele_sellers(username,collector_id,encrypted_tokens,expires_at) values('test-v297-pro','FICTICIO','FICTICIO',now()+interval '1 day');
update hc_tele_settings set enabled=true,commission_bps=2000,cancellation_policy='FICTICIO' where id;
b=hc297_reserve('test-v297-pro','test-v297-client','office',st+interval '7 hours',15,gen_random_uuid(),'FICTICIO',2,false);
if b->>'payment_model'<>'split_full' or (b->>'platform_cents')::integer<>40000 then raise exception 'Full split snapshot incorrect';end if;
if (select amount_cents from hc_tele_payments where visit_id=(b->>'id')::uuid)<>200000 then raise exception 'Office still charges only a deposit';end if;
update hc_tele_payments set collector_id='FICTICIO',consented_at=now() where visit_id=(b->>'id')::uuid;
perform hc292_apply_tele_payment((select id from hc_tele_payments where visit_id=(b->>'id')::uuid),'TESTV297',200000,'FICTICIO','approved',0);
if (select status from hc_tele_visits where id=(b->>'id')::uuid)<>'confirmed' then raise exception 'Full office payment not confirmed';end if;
if has_function_privilege('authenticated','public.hc297_save_note(text,uuid,integer,jsonb)','execute') then raise exception 'Clinical function accessible to clients';end if;
end$test$;
rollback;
select 'PASS: independent access, multi-location slots, gaps, conflicts, immutable address, clinical saves, revisions, author isolation, audit versions and full office split; fictitious records rolled back' as result;
