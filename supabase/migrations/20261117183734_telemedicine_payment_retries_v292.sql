create or replace function public.hc292_apply_tele_payment(payment uuid,external_id text,paid_amount bigint,collector text,provider_status text,refunded bigint default 0) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare p hc_tele_payments;v hc_tele_visits;review text='';
begin
 select v0.provider into v.provider from hc_tele_visits v0 join hc_tele_payments p0 on p0.visit_id=v0.id where p0.id=payment;
 perform pg_advisory_xact_lock(hashtextextended('hc289-provider:'||v.provider,0));
 select * into p from hc_tele_payments where id=payment for update;select * into v from hc_tele_visits where id=p.visit_id for update;
 if p.id is null or p.collector_id is distinct from collector or p.amount_cents<>paid_amount then raise exception 'El pago no coincide con el importe o destinatario';end if;
 if p.applied and p.payment_id is not null and p.payment_id<>external_id then review='Pago duplicado: requiere reintegro';
 elsif provider_status='approved' and refunded=0 and not p.applied then
  if v.status in('cancelled','expired','finished','payment_review') or p.expires_at<now() or p.consented_at is null or not p.provider_approved or p.kind='initial' and v.hold_until<now() then review='Pago fuera de la reserva: requiere revisión y reintegro';
  else
   begin perform hc292_assert_free(v.provider,v.starts_at,greatest(v.ends_at,coalesce(p.hold_end,v.ends_at)),v.id);exception when others then review='El horario dejó de estar disponible: revisar reintegro';end;
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
end$$;
