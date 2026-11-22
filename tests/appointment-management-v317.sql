begin;
insert into hc_auth_users(username,name,default_role) values
 ('test-v317-pro','Profesional de prueba','medico'),
 ('test-v317-booked','Paciente de prueba','cliente'),
 ('test-v317-wait','Paciente en espera','cliente'),
 ('test-v317-other','Paciente de otra especialidad','cliente');
insert into hc_portal_clients(username,legal_name,dni,dob,document_path) values
 ('test-v317-booked','Paciente de prueba','99998971','1990-01-01','ficticio'),
 ('test-v317-wait','Paciente en espera','99998972','1990-01-01','ficticio'),
 ('test-v317-other','Paciente de otra especialidad','99998973','1990-01-01','ficticio');
insert into hc_auth_institutions(id,data_institution_id,name) values('test-v317-inst','test-v317-inst','Institución ficticia');
insert into hc_auth_memberships(username,institution_id,role) values('test-v317-pro','test-v317-inst','medico');
insert into hc_portal_institutions(institution_id,enabled,address) values('test-v317-inst',true,'Calle ficticia');
insert into hc_portal_verifications(username,institution_id,status) values
 ('test-v317-booked','test-v317-inst','verified'),
 ('test-v317-wait','test-v317-inst','verified');
insert into hc_portal_providers(username,institution_id,public_visible,specialty,weekly)
  select 'test-v317-pro','test-v317-inst',true,'Cardiología',
    jsonb_build_object('days',jsonb_object_agg(day::text,'{"active":true,"start":"08:00","end":"18:00","minutes":30}'::jsonb))
  from generate_series(0,6) day;
insert into hc_tele_profiles(username,role,specialty,credential,public_visible,modes)
  select 'test-v317-pro','medico','Cardiología','FICTICIA',true,
    jsonb_build_object('office',jsonb_build_object('enabled',true,'rates','[{"minutes":30,"amount_cents":150000}]'::jsonb,
      'weekly',jsonb_build_object('days',jsonb_object_agg(day::text,
        '{"active":true,"windows":[{"start":"08:00","end":"12:00","address":"Sede Norte","latitude":-31.4,"longitude":-64.2},{"start":"14:00","end":"18:00","address":"Sede Sur","latitude":-31.5,"longitude":-64.2}]}'::jsonb))))
  from generate_series(0,6) day;

do $test$
declare
  day date:=(now() at time zone 'America/Argentina/Buenos_Aires')::date+2;
  first_at timestamptz:=(day+time '08:00') at time zone 'America/Argentina/Buenos_Aires';
  next_at timestamptz:=first_at+interval '6 hours';
  patient text:='test-v317-booked';
  clinician text:='test-v317-pro';
  waiter text:='test-v317-wait';
  other text:='test-v317-other';
  private_id uuid;
  institution_id uuid;
  options jsonb;
  enrollment jsonb;
  failed boolean;
begin
  if has_table_privilege('anon','public.hc_appointment_waitlist','SELECT') or
     has_function_privilege('authenticated','public.hc317_change_private_visit(text,uuid,timestamptz,timestamptz)','EXECUTE') then
    raise exception 'Appointment data exposed directly';
  end if;
  enrollment:=hc317_join_waitlist(waiter,'office','medico','Cardiología',day);
  if enrollment->>'id'<>hc317_join_waitlist(waiter,'office','medico','Cardiología',day)->>'id' then
    raise exception 'Duplicate entry on retry';
  end if;
  perform hc317_join_waitlist(waiter,'office','medico','',day);
  perform hc317_join_waitlist(other,'office','medico','Pediatría',day);
  perform hc317_join_waitlist(waiter,'institution','medico','Cardiología',day);
  insert into hc_tele_visits(request_id,provider,client,mode,starts_at,ends_at,minutes,total_cents,platform_cents,provider_cents,
    commission_bps,policy_snapshot,profile_revision,status,location_snapshot,payment_model)
    values(gen_random_uuid(),clinician,patient,'office',first_at,first_at+interval '30 minutes',30,150000,30000,120000,2000,'ficticia',1,'confirmed','Sede Norte','split_full')
    returning id into private_id;
  insert into hc_tele_payments(visit_id,kind,minutes,amount_cents,platform_cents,provider_cents,status,provider_approved)
    values(private_id,'initial',30,150000,30000,120000,'approved',true);
  insert into hc_portal_bookings(provider_id,username,starts_at,ends_at,status)
    select p.id,patient,next_at,next_at+interval '30 minutes','confirmed' from hc_portal_providers p where p.username=clinician
    returning id into institution_id;
  failed:=false;
  begin perform hc317_change_private_visit(patient,private_id,first_at,next_at);
  exception when raise_exception then failed:=true; end;
  if not failed or (select starts_at from hc_tele_visits where id=private_id)<>first_at then raise exception 'Conflict lost original booking'; end if;
  failed:=false;
  begin perform hc317_change_private_visit(other,private_id,first_at,null);
  exception when raise_exception then failed:=true; end;
  if not failed then raise exception 'Another patient could cancel'; end if;
  perform hc317_change_institution_booking(patient,institution_id,next_at,next_at+interval '1 hour');
  perform hc317_change_private_visit(patient,private_id,first_at,next_at);
  perform hc317_change_private_visit(patient,private_id,first_at,next_at);
  if (select location_snapshot from hc_tele_visits where id=private_id)<>'Sede Sur'
    or (select count(*) from hc_tele_payments where visit_id=private_id and status='approved')<>1
    or (select count(*) from hc_notifications where username=waiter and kind='appointment_waitlist' and payload->>'mode'='office')<>1
    or exists(select 1 from hc_notifications where username=other) then raise exception 'Reprogramming or waitlist delivery failed'; end if;
  if (select count(*) from hc_notifications where kind='appointment_change' and username in (patient,clinician))<>4 then
    raise exception 'Changes did not reach both sides once';
  end if;
  options:=hc317_next_private_slots(clinician,'office',day,day+13,30);
  if jsonb_array_length(options)<>2 or (options->0->>'start')::timestamptz<>first_at or options->0->>'address'<>'Sede Norte' then
    raise exception 'Released slot is missing from next offers';
  end if;
  if not (hc317_change_private_visit(patient,private_id,next_at,null)->>'refundPending')::boolean then raise exception 'Refund review missing'; end if;
  perform hc317_change_private_visit(patient,private_id,next_at,null);
  perform hc317_change_institution_booking(patient,institution_id,next_at+interval '1 hour',null);
  if (select count(*) from hc_tele_refund_requests r join hc_tele_payments p on p.id=r.payment_id where p.visit_id=private_id)<>1
    or (select count(*) from hc_notifications where username=waiter and kind='appointment_waitlist')<>4 then
    raise exception 'Cancellation did not release both slots exactly once';
  end if;
end $test$;
rollback;
select 'PASS: reprogramación, conflictos, cancelación, reintegro, avisos y próximas opciones' as result;
