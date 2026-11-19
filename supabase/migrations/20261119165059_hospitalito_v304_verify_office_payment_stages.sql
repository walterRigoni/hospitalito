DO $test$
DECLARE suffix text=replace(gen_random_uuid()::text,'-','');who text;patient text;v jsonb;t jsonb;payment jsonb;p uuid;q uuid;start_at timestamptz;failed boolean;expected bigint;
BEGIN
 BEGIN
 who='v304_test_pro_'||suffix;patient='v304_test_patient_'||suffix;
 INSERT INTO public.hc_auth_users(username,name,default_role,active) VALUES(who,'Prueba transaccional v304','medico',true),(patient,'Paciente de prueba v304','cliente',true);
 INSERT INTO public.hc_portal_clients(username,legal_name,dni,dob,document_path) VALUES(patient,'Paciente de prueba v304','99999304','1990-01-01','test/v304');
 INSERT INTO public.hc_tele_profiles(username,role,specialty,public_visible,revision,modes)
 SELECT who,'medico','Prueba',true,1,jsonb_build_object('office',jsonb_build_object('enabled',true,'rates',jsonb_build_array(jsonb_build_object('minutes',30,'amount_cents',10001)),'weekly',jsonb_build_object('days',days)),'telemedicine',jsonb_build_object('enabled',true,'rates',jsonb_build_array(jsonb_build_object('minutes',30,'amount_cents',10001)),'weekly',jsonb_build_object('days',days)))
 FROM (SELECT jsonb_object_agg(n::text,jsonb_build_object('active',true,'start','00:00','end','23:45','windows',jsonb_build_array(jsonb_build_object('start','00:00','end','23:45','address','Consultorio de prueba')))) AS days FROM generate_series(0,6)n)d;
 INSERT INTO public.hc_tele_sellers(username,collector_id,encrypted_tokens,expires_at) VALUES(who,'304','test-only-never-used',now()+interval '1 day');
 UPDATE public.hc_tele_settings SET enabled=true,commission_bps=2000,office_deposit_bps=3000,cancellation_policy='Condiciones de prueba dentro de una transacción que se revierte';
 start_at=(date_trunc('day',now() AT TIME ZONE 'America/Argentina/Buenos_Aires')+interval '1 day 10 hours') AT TIME ZONE 'America/Argentina/Buenos_Aires';
 v=public.hc304_reserve(who,patient,'office',start_at,30,gen_random_uuid(),'Prueba',1,false,3000);
 IF v->>'payment_model'<>'office_staged' OR (v->>'deposit_cents')::bigint<>3000 OR (v->>'balance_cents')::bigint<>7001 OR (v->>'platform_cents')::bigint<>2000 THEN RAISE EXCEPTION 'FAIL: rounding or independent percentages';END IF;
 SELECT id INTO p FROM public.hc_tele_payments WHERE visit_id=(v->>'id')::uuid AND kind='initial';
 IF (SELECT amount_cents FROM public.hc_tele_payments WHERE id=p)<>3000 THEN RAISE EXCEPTION 'FAIL: charged full total at reservation';END IF;
 failed=false;BEGIN PERFORM public.hc304_start_office((v->>'id')::uuid);EXCEPTION WHEN OTHERS THEN failed=true;END;
 IF NOT failed THEN RAISE EXCEPTION 'FAIL: balance opened before deposit';END IF;
 UPDATE public.hc_tele_payments SET collector_id='304',consented_at=now() WHERE id=p;
 failed=false;BEGIN PERFORM public.hc292_apply_tele_payment(p,'9304001',3001,'304','approved',0);EXCEPTION WHEN OTHERS THEN failed=true;END;
 IF NOT failed THEN RAISE EXCEPTION 'FAIL: incorrect payment amount accepted';END IF;
 failed=false;BEGIN PERFORM public.hc292_apply_tele_payment(p,'9304001',3000,'999','approved',0);EXCEPTION WHEN OTHERS THEN failed=true;END;
 IF NOT failed THEN RAISE EXCEPTION 'FAIL: incorrect collector accepted';END IF;
 PERFORM public.hc292_apply_tele_payment(p,'9304001',3000,'304','approved',0);
 PERFORM public.hc292_apply_tele_payment(p,'9304001',3000,'304','approved',0);
 IF (SELECT status FROM public.hc_tele_visits WHERE id=(v->>'id')::uuid)<>'confirmed' THEN RAISE EXCEPTION 'FAIL: deposit did not confirm reservation';END IF;
 UPDATE public.hc_tele_settings SET office_deposit_bps=4000,commission_bps=2500;
 payment=public.hc304_start_office((v->>'id')::uuid);q=(payment->>'id')::uuid;
 t=public.hc304_start_office((v->>'id')::uuid);
 IF t->>'id'<>payment->>'id' OR (payment->>'amount_cents')::bigint<>7001 OR (payment->>'platform_cents')::bigint<>1400 THEN RAISE EXCEPTION 'FAIL: duplicate balance or settings changed accepted price';END IF;
 IF (SELECT sum(amount_cents) FROM public.hc_tele_payments WHERE visit_id=(v->>'id')::uuid)<>10001 OR (SELECT sum(platform_cents) FROM public.hc_tele_payments WHERE visit_id=(v->>'id')::uuid)<>2000 THEN RAISE EXCEPTION 'FAIL: phase totals do not match';END IF;
 UPDATE public.hc_tele_visits SET status='finished',finished_at=now() WHERE id=(v->>'id')::uuid;
 UPDATE public.hc_tele_payments SET collector_id='304',consented_at=now() WHERE id=q;
 PERFORM public.hc292_apply_tele_payment(q,'9304002',7001,'304','approved',0);
 PERFORM public.hc292_apply_tele_payment(q,'9304002',7001,'304','approved',0);
 IF (SELECT sum(amount_cents) FROM public.hc_tele_payments WHERE visit_id=(v->>'id')::uuid AND status='approved' AND applied)<>10001 THEN RAISE EXCEPTION 'FAIL: balance after clinical completion or webhook idempotency';END IF;
 failed=false;BEGIN PERFORM public.hc304_reserve(who,patient,'office',start_at+interval '1 day',30,gen_random_uuid(),'Stale quote',1,false,3000);EXCEPTION WHEN OTHERS THEN failed=true;END;
 IF NOT failed THEN RAISE EXCEPTION 'FAIL: stale percentage accepted';END IF;
 t=public.hc297_reserve(who,patient,'telemedicine',start_at+interval '1 day',30,gen_random_uuid(),'Telemedicina',1,false);
 IF (SELECT amount_cents FROM public.hc_tele_payments WHERE visit_id=(t->>'id')::uuid AND kind='initial')<>10001 OR t->>'payment_model'<>'split_full' THEN RAISE EXCEPTION 'FAIL: telemedicine no longer paid in full';END IF;
 INSERT INTO public.hc_auth_users(username,name,default_role,active) VALUES(who||'_free','Profesional gratuito de prueba','medico',true);
 INSERT INTO public.hc_tele_profiles(username,role,specialty,public_visible,revision,modes) SELECT who||'_free',role,specialty,true,1,modes FROM public.hc_tele_profiles WHERE username=who;
 t=public.hc304_reserve(who||'_free',patient,'office',start_at+interval '2 days',30,gen_random_uuid(),'Prueba gratuita',1,true,null);
 IF (t->>'total_cents')::bigint<>0 OR t->>'status'<>'confirmed' OR EXISTS(SELECT 1 FROM public.hc_tele_payments WHERE visit_id=(t->>'id')::uuid) THEN RAISE EXCEPTION 'FAIL: trial became paid';END IF;
 IF has_function_privilege('anon','public.hc304_start_office(uuid)','EXECUTE') OR has_function_privilege('authenticated','public.hc304_reserve(text,text,text,timestamptz,integer,uuid,text,integer,boolean,integer)','EXECUTE') THEN RAISE EXCEPTION 'FAIL: exposed privileged function';END IF;
 RAISE EXCEPTION USING ERRCODE='P0304',MESSAGE='v304 test fixtures rolled back';
 EXCEPTION WHEN SQLSTATE 'P0304' THEN NULL;
 END;
END $test$;
SELECT 'v304 billing integration assertions passed; all fixtures and schema changes rolled back' AS result;
