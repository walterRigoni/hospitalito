create or replace function public.hc284_save_layout(p_institution text,p_actor text,p_expected bigint,p_payload jsonb) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare inst public.hc_auth_institutions;layout public.hc_institution_layouts;reg jsonb;current_beds jsonb;wanted jsonb;all_beds jsonb;begin
 select * into inst from public.hc_auth_institutions where id=p_institution and active for update;if not found then raise exception 'Institución no disponible';end if;
 select * into layout from public.hc_institution_layouts where institution_id=p_institution for update;
 if coalesce(layout.revision,0)<>p_expected then raise exception 'Otro usuario modificó los servicios. Actualizá antes de guardar';end if;
 wanted=p_payload->'beds';if jsonb_typeof(wanted)<>'array' or jsonb_array_length(wanted)<1 or jsonb_array_length(wanted)>2000 then raise exception 'Configurá entre 1 y 2000 camas';end if;
 if exists(select 1 from jsonb_array_elements(wanted) x where coalesce(x->>'id','')='' or coalesce(x->>'area','')='' or coalesce(x->>'label','')='') or (select count(distinct x->>'id') from jsonb_array_elements(wanted) x)<>jsonb_array_length(wanted) or (select count(distinct (x->>'area',x->>'label')) from jsonb_array_elements(wanted) x)<>jsonb_array_length(wanted) then raise exception 'Camas inválidas o duplicadas';end if;
 select payload->'value' into reg from public.hc_state where institution_id=coalesce(inst.data_institution_id,inst.id) and bucket='registry' and record_id='main' for update;
 if exists(select 1 from jsonb_array_elements(coalesce(reg,'[]')) x where coalesce((x->>'active')::boolean,true) and coalesce(x->>'bedId','')<>'' and not exists(select 1 from jsonb_array_elements(wanted) b where b->>'id'=x->>'bedId')) then raise exception 'No podés retirar una cama ocupada. Primero resolvé el traslado o el alta';end if;
 select payload->'value' into current_beds from public.hc_state where institution_id=coalesce(inst.data_institution_id,inst.id) and bucket='beds' and record_id='main' for update;
 select coalesce(jsonb_agg(x||jsonb_build_object('retired',true,'active',false,'updatedAt',now(),'updatedBy',p_actor)),'[]') into all_beds from jsonb_array_elements(coalesce(current_beds,'[]')) x where not exists(select 1 from jsonb_array_elements(wanted) b where b->>'id'=x->>'id');
 select all_beds||jsonb_agg(x||jsonb_build_object('retired',false,'active',true,'bed',x->>'label','updatedAt',now(),'updatedBy',p_actor)) into all_beds from jsonb_array_elements(wanted) x;
 insert into public.hc_institution_layouts(institution_id,payload,updated_by) values(p_institution,p_payload,p_actor) on conflict(institution_id) do update set payload=excluded.payload,updated_by=excluded.updated_by returning * into layout;
 insert into public.hc_state(institution_id,bucket,record_id,payload,sort_index,deleted,writer) values(coalesce(inst.data_institution_id,inst.id),'beds','main',jsonb_build_object('value',all_beds),0,false,p_actor) on conflict(institution_id,bucket,record_id) do update set payload=excluded.payload,deleted=false,writer=excluded.writer;
 return jsonb_build_object('layout',to_jsonb(layout),'beds',all_beds);
end $$;

create index hc284_billing_contracts_account on public.hc_billing_contracts(account_id);
create index hc284_billing_contracts_user on public.hc_billing_contracts(username);
create index hc284_billing_invoices_account on public.hc_billing_invoices(account_id);
create index hc284_billing_checkouts_account on public.hc_billing_checkouts(account_id);
create index hc284_passkey_challenges_user on public.hc_passkey_challenges(username);
create index hc284_seed_devices_institution on public.hc_seed_devices(institution_id);
alter function public.hc_touch_updated_at() set search_path=pg_catalog,public;
