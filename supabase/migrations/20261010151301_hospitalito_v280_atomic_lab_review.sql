create or replace function public.hc280_approve_lab(p_institution text,p_id uuid,p_user text,p_name text)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare inbox public.hc_lab_inbox%rowtype; reqrow public.hc_state%rowtype; resrow public.hc_state%rowtype; req jsonb; result jsonb; requests jsonb; results jsonb; ts text; rid text;
begin
 select * into inbox from public.hc_lab_inbox where id=p_id and institution_id=p_institution for update;
 if not found then raise exception 'No se encontró el envío'; end if;
 if inbox.status='reviewed' then return jsonb_build_object('ok',true,'alreadyReviewed',true); end if;
 if inbox.status<>'pending' then raise exception 'El envío ya fue rechazado'; end if;
 select * into reqrow from public.hc_state where institution_id=p_institution and bucket='clinical' and record_id=inbox.patient_id||'::labRequests' and not deleted for update;
 if not found then raise exception 'No se encontró la solicitud original'; end if;
 select e into req from jsonb_array_elements(reqrow.payload->'value') e where e->>'id'=inbox.request_id;
 if req is null or coalesce((req->>'completed')::boolean,false) then raise exception 'La solicitud no está pendiente'; end if;
 ts=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 req=req||jsonb_build_object('completed',true,'completedAt',ts,'updatedAt',ts);
 result=jsonb_build_object('id','labext_'||inbox.id::text,'requestId',inbox.request_id,'request',req,'resultRows',inbox.payload->'resultRows','freeNote',coalesce(inbox.payload->>'freeNote',''),'resultText',coalesce(inbox.payload->>'resultText',''),'reportedAt',ts,'reportedBy',p_user,'reportedByName',p_name,'source',inbox.source,'externalMessageId',inbox.message_id,'validated',true,'validatedAt',ts);
 select coalesce(jsonb_agg(case when e->>'id'=inbox.request_id then req else e end),'[]') into requests from jsonb_array_elements(reqrow.payload->'value') e;
 update public.hc_state set payload=jsonb_build_object('value',requests),writer=p_user where institution_id=p_institution and bucket='clinical' and record_id=reqrow.record_id;
 rid=inbox.patient_id||'::labResults';
 insert into public.hc_state(institution_id,bucket,record_id,payload,writer,deleted) values(p_institution,'clinical',rid,jsonb_build_object('value',jsonb_build_array(result)),p_user,false)
 on conflict(institution_id,bucket,record_id) do update set payload=jsonb_build_object('value',public.hc280_merge_history(public.hc_state.payload->'value',jsonb_build_array(result))),deleted=false,writer=p_user;
 update public.hc_lab_inbox set status='reviewed',reviewed_at=now(),reviewed_by=p_user where id=p_id;
 return jsonb_build_object('ok',true,'result',result);
end;
$$;
revoke all on function public.hc280_approve_lab(text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.hc280_approve_lab(text,uuid,text,text) to service_role;
