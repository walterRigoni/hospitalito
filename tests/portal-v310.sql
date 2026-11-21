BEGIN;
INSERT INTO hc_auth_users (username,name,default_role) VALUES
 ('test-v310-provider','Profesional ficticio v310','medico'),
 ('test-v310-client','Paciente ficticio v310','cliente');
INSERT INTO hc_portal_clients (username, legal_name, dni, dob, document_path)
 VALUES ('test-v310-client','Paciente ficticio v310','99999995','1990-01-01','prueba-v310');
INSERT INTO hc_tele_profiles (username,role,specialty,credential,public_visible,modes)
SELECT 'test-v310-provider','medico','Cardiología','prueba',true,
 jsonb_build_object('home',jsonb_build_object('enabled',true,'rates','[{"minutes":30,"amount_cents":150000}]'::jsonb,
 'weekly',jsonb_build_object('days',jsonb_object_agg(day::text,'{"active":true,"windows":[{"start":"08:00","end":"12:00"}]}'::jsonb))))
FROM generate_series(0,6) day;

DO $test$
DECLARE
 selected_day date := (now() at time zone 'America/Argentina/Buenos_Aires')::date+2;
 start_at timestamptz := (selected_day+time '08:00') at time zone 'America/Argentina/Buenos_Aires';
 request_id uuid := gen_random_uuid();
 result jsonb;
BEGIN
 IF NOT EXISTS(SELECT FROM jsonb_array_elements(hc297_available_slots('test-v310-provider','home',selected_day,30)) x
   WHERE (x->>'start')::timestamptz=start_at AND (x->>'available')::boolean) THEN
   RAISE EXCEPTION 'No published home slot';
 END IF;
 result:=hc310_reserve_home('test-v310-provider','test-v310-client','home',start_at,30,request_id,'',1,true,'Calle ficticia 123');
 IF result->>'mode'<>'home' OR result->>'location_snapshot'<>'Calle ficticia 123' OR result->>'status'<>'confirmed' THEN
   RAISE EXCEPTION 'Home visit incorrectly recorded';
 END IF;
 IF NOT EXISTS(SELECT FROM hc_notifications WHERE username='test-v310-provider' AND kind='tele_booking'
   AND payload->>'visitId'=result->>'id') THEN RAISE EXCEPTION 'Missing professional alert'; END IF;
 IF EXISTS(SELECT FROM jsonb_array_elements(hc297_available_slots('test-v310-provider','home',selected_day,30)) x
   WHERE (x->>'start')::timestamptz=start_at AND (x->>'available')::boolean) THEN
   RAISE EXCEPTION 'Booked slot still available';
 END IF;
 IF result->>'id'<>hc310_reserve_home('test-v310-provider','test-v310-client','home',start_at,30,request_id,'',1,true,'Calle ficticia 123')->>'id' THEN
   RAISE EXCEPTION 'Retry created another visit';
 END IF;
 IF has_function_privilege('anon','public.hc310_reserve_home(text,text,text,timestamptz,integer,uuid,text,integer,boolean,text)','EXECUTE') THEN
   RAISE EXCEPTION 'Home booking SQL exposed to anonymous users';
 END IF;
END $test$;
ROLLBACK;
SELECT 'PASS: disponibilidad, reserva a domicilio, bloqueo del turno, reintento y aviso al profesional' AS result;
