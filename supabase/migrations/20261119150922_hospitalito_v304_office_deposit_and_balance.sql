-- v304: new reservations keep independent, immutable commission and deposit snapshots.
ALTER TABLE public.hc_tele_settings ADD COLUMN IF NOT EXISTS office_deposit_bps integer CHECK(office_deposit_bps BETWEEN 1 AND 9999);
ALTER TABLE public.hc_tele_visits ADD COLUMN IF NOT EXISTS office_deposit_bps integer;
ALTER TABLE public.hc_tele_visits ADD COLUMN IF NOT EXISTS deposit_cents bigint;
ALTER TABLE public.hc_tele_visits ADD COLUMN IF NOT EXISTS balance_cents bigint;
ALTER TABLE public.hc_tele_visits DROP CONSTRAINT hc_tele_visits_payment_model_check;
ALTER TABLE public.hc_tele_visits ADD CONSTRAINT hc_tele_visits_payment_model_check CHECK(payment_model IN('legacy_office_deposit','split_full','office_staged'));
ALTER TABLE public.hc_tele_visits ADD CONSTRAINT hc304_office_amounts CHECK(payment_model<>'office_staged' OR (mode='office' AND NOT is_trial AND office_deposit_bps IS NOT NULL AND office_deposit_bps BETWEEN 1 AND 9999 AND deposit_cents IS NOT NULL AND deposit_cents>0 AND balance_cents IS NOT NULL AND balance_cents>0 AND deposit_cents+balance_cents=total_cents));
ALTER TABLE public.hc_tele_payments DROP CONSTRAINT hc_tele_payments_kind_check;
ALTER TABLE public.hc_tele_payments ADD CONSTRAINT hc_tele_payments_kind_check CHECK(kind IN('initial','extension','balance'));
CREATE UNIQUE INDEX hc304_balance_open ON public.hc_tele_payments(visit_id) WHERE kind='balance' AND status IN('offered','pending','rejected');
CREATE UNIQUE INDEX hc304_balance_paid ON public.hc_tele_payments(visit_id) WHERE kind='balance' AND status='approved' AND applied;

CREATE OR REPLACE FUNCTION public.hc304_reserve(who text, patient text, mode_name text, at_start timestamp with time zone, duration integer, request_key uuid, visit_reason text, expected_revision integer, expected_trial boolean, expected_deposit_bps integer DEFAULT NULL)
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
 if mode_name not in('telemedicine','office') or not coalesce((p.modes->mode_name->>'enabled')::boolean,false) then raise exception 'Modalidad no publicada';end if;
 select * into s from hc_tele_settings where id;
 trial=not exists(select 1 from hc_tele_sellers where username=who);if trial is distinct from expected_trial then raise exception 'Cambió la condición de cobro. Actualizá el perfil';end if;
 if not trial and (not s.enabled or s.commission_bps is null or s.cancellation_policy='') then raise exception 'Los cobros todavía no están habilitados por Hospitalito';end if;
 if not trial and mode_name='office' and (s.office_deposit_bps is null or s.office_deposit_bps is distinct from expected_deposit_bps) then raise exception 'El porcentaje de reserva cambió o está pendiente. Actualizá el precio antes de reservar';end if;
 daykey=extract(dow from at_start at time zone 'America/Argentina/Buenos_Aires')::integer::text;d=p.modes->mode_name->'weekly'->'days'->daykey;clock=(at_start at time zone 'America/Argentina/Buenos_Aires')::time;at_end=at_start+make_interval(mins=>duration);
 select value into w from jsonb_array_elements(coalesce(d->'windows',jsonb_build_array(jsonb_build_object('start',d->>'start','end',d->>'end','address',p.address))))
 where clock>=(value->>'start')::time and (at_end at time zone 'America/Argentina/Buenos_Aires')::time<=(value->>'end')::time
 and mod(extract(epoch from(clock-(value->>'start')::time))::integer,900)=0 limit 1;
 if duration not in(15,30,45,60) or at_start<now() or at_start>now()+interval '90 days' or not coalesce((d->>'active')::boolean,false) or w is null or (at_end at time zone 'America/Argentina/Buenos_Aires')::date<>(at_start at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'Horario fuera de la disponibilidad publicada';end if;
 loc=case when mode_name='office' then coalesce(w->>'address',p.address) else '' end;
 select value into r from jsonb_array_elements(p.modes->mode_name->'rates') where (value->>'minutes')::integer=duration;amount=(r->>'amount_cents')::bigint;
 if amount is null or amount<100 then raise exception 'Ese precio no está publicado';end if;
 fee=case when trial then 0 else round(amount*s.commission_bps/10000.0) end;if not trial and (fee<1 or fee>=amount) then raise exception 'Comisión incompatible con el precio';end if;
 perform hc292_assert_free(who,at_start,at_end);
 if trial then amount=0;end if;
 deposit=case when mode_name='office' and not trial then round(amount*s.office_deposit_bps/10000.0) else null end;
 if deposit is not null and (deposit<1 or deposit>=amount) then raise exception 'El anticipo es incompatible con este precio. Hospitalito debe revisar el porcentaje';end if;
 initial_amount=coalesce(deposit,amount);initial_fee=case when deposit is null then fee else round(deposit*s.commission_bps/10000.0) end;
 insert into hc_tele_visits(request_id,provider,client,mode,starts_at,ends_at,minutes,total_cents,platform_cents,provider_cents,commission_bps,reason,policy_snapshot,profile_revision,is_trial,status,location_snapshot,payment_model,office_deposit_bps,deposit_cents,balance_cents) values(request_key,who,patient,mode_name,at_start,at_end,duration,amount,fee,amount-fee,case when trial then 0 else s.commission_bps end,left(visit_reason,1000),case when trial then 'Consulta de prueba gratuita, sin cobros posteriores para esta reserva.' else s.cancellation_policy end,p.revision,trial,case when trial then 'confirmed' else 'awaiting_payment' end,loc,case when deposit is null then 'split_full' else 'office_staged' end,case when deposit is null then null else s.office_deposit_bps end,deposit,case when deposit is null then null else amount-deposit end) returning * into v;
 if not trial then insert into hc_tele_payments(visit_id,kind,minutes,amount_cents,platform_cents,provider_cents,status,provider_approved) values(v.id,'initial',duration,initial_amount,initial_fee,initial_amount-initial_fee,'offered',true);end if;
 return to_jsonb(v);
end$function$

;
CREATE OR REPLACE FUNCTION public.hc304_start_office(visit uuid)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO public,pg_temp AS $function$
DECLARE v hc_tele_visits;initial_payment hc_tele_payments;payment hc_tele_payments;fee bigint;
BEGIN
 SELECT provider INTO v.provider FROM hc_tele_visits WHERE id=visit;
 PERFORM pg_advisory_xact_lock(hashtextextended('hc289-provider:'||v.provider,0));
 SELECT * INTO v FROM hc_tele_visits WHERE id=visit FOR UPDATE;
 IF v.id IS NULL OR v.mode<>'office' OR v.is_trial OR v.payment_model<>'office_staged' OR v.status NOT IN('confirmed','active','finished') THEN RAISE EXCEPTION 'Esta consulta no admite cobrar saldo presencial';END IF;
 SELECT * INTO initial_payment FROM hc_tele_payments WHERE visit_id=visit AND kind='initial' AND status='approved' AND applied;
 IF initial_payment.id IS NULL THEN RAISE EXCEPTION 'Primero debe aprobarse el anticipo de la reserva';END IF;
 IF v.status='confirmed' THEN UPDATE hc_tele_visits SET status='active',active_at=now() WHERE id=visit;END IF;
 UPDATE hc_tele_payments SET status='expired' WHERE visit_id=visit AND kind='balance' AND status IN('offered','pending','rejected') AND expires_at<=now();
 SELECT * INTO payment FROM hc_tele_payments WHERE visit_id=visit AND kind='balance' AND status IN('offered','pending','rejected','approved','review') ORDER BY created_at DESC LIMIT 1;
 IF payment.id IS NOT NULL THEN RETURN to_jsonb(payment);END IF;
 fee=v.platform_cents-initial_payment.platform_cents;
 INSERT INTO hc_tele_payments(visit_id,kind,minutes,amount_cents,platform_cents,provider_cents,status,provider_approved,expires_at)
 VALUES(v.id,'balance',v.minutes,v.balance_cents,fee,v.balance_cents-fee,'offered',true,now()+interval '24 hours') RETURNING * INTO payment;
 RETURN to_jsonb(payment);
END $function$;

CREATE OR REPLACE FUNCTION public.hc292_apply_tele_payment(payment uuid, external_id text, paid_amount bigint, collector text, provider_status text, refunded bigint DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare p hc_tele_payments;v hc_tele_visits;review text='';
begin
 select v0.provider into v.provider from hc_tele_visits v0 join hc_tele_payments p0 on p0.visit_id=v0.id where p0.id=payment;
 perform pg_advisory_xact_lock(hashtextextended('hc289-provider:'||v.provider,0));
 select * into p from hc_tele_payments where id=payment for update;select * into v from hc_tele_visits where id=p.visit_id for update;
 if p.id is null or p.collector_id is distinct from collector or p.amount_cents<>paid_amount then raise exception 'El pago no coincide con el importe o destinatario';end if;
 if p.applied and p.payment_id is not null and p.payment_id<>external_id then review='Pago duplicado: requiere reintegro';
 elsif provider_status='approved' and refunded=0 and not p.applied then
  if v.status in('cancelled','expired','payment_review') or (v.status='finished' and p.kind<>'balance') or (p.kind='balance' and (v.payment_model<>'office_staged' or v.active_at is null or v.status not in('active','finished'))) or p.expires_at<now() or p.consented_at is null or not p.provider_approved or p.kind='initial' and v.hold_until<now() then review='Pago fuera de la reserva: requiere revisión y reintegro';
  else
   if p.kind<>'balance' then begin perform hc292_assert_free(v.provider,v.starts_at,greatest(v.ends_at,coalesce(p.hold_end,v.ends_at)),v.id);exception when others then review='El horario dejó de estar disponible: revisar reintegro';end;end if;
   if review='' then update hc_tele_payments set status='approved',payment_id=external_id,applied=true where id=p.id;
   if p.kind='initial' then update hc_tele_visits set status='confirmed' where id=v.id;end if;end if;
  end if;
 elsif refunded>0 or provider_status in('refunded','charged_back','cancelled') then
  update hc_tele_payments set status=case when refunded>=paid_amount or provider_status='refunded' then 'refunded' else 'review' end where id=p.id;
  if p.applied then update hc_tele_visits set status='payment_review',client_connected=false,provider_connected=false where id=v.id;end if;
 elsif not p.applied then update hc_tele_payments set status=case when provider_status='rejected' then 'rejected' else 'pending' end,payment_id=external_id where id=p.id;
 end if;
 insert into hc_tele_payment_events(payment_id,payment_ref,amount_cents,provider_status,review_reason) values(external_id,p.id,paid_amount,provider_status,review) on conflict(payment_id) do update set provider_status=excluded.provider_status,review_reason=excluded.review_reason,updated_at=now();
 if review<>'' then
  insert into hc_tele_refund_requests(payment_id,requested_by,reason) values(p.id,'mercadopago',review) on conflict do nothing;
  if not p.applied then update hc_tele_payments set status='review' where id=p.id;update hc_tele_visits set status='payment_review' where id=v.id;end if;
 end if;
 return jsonb_build_object('ok',true,'review',review,'visitId',v.id);
end$function$

;
REVOKE ALL ON FUNCTION public.hc304_reserve(text,text,text,timestamptz,integer,uuid,text,integer,boolean,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hc304_reserve(text,text,text,timestamptz,integer,uuid,text,integer,boolean,integer) TO service_role;
REVOKE ALL ON FUNCTION public.hc304_start_office(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hc304_start_office(uuid) TO service_role;
