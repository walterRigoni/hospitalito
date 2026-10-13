create table public.hc_billing_settings(key text primary key, payload jsonb not null default '{}', updated_by text, updated_at timestamptz not null default now());
insert into public.hc_billing_settings values('main','{"defaultTrialDays":30,"collectionEnabled":false}',null,now());
create table public.hc_billing_accounts(id uuid primary key default gen_random_uuid(),payload jsonb not null,revision bigint not null default 1,updated_by text not null,updated_at timestamptz not null default now());
create table public.hc_billing_contracts(
 id uuid primary key default gen_random_uuid(), institution_id text not null references public.hc_auth_institutions(id),
 username text references public.hc_auth_users(username), account_id uuid references public.hc_billing_accounts(id),
 payload jsonb not null, revision bigint not null default 1, updated_by text not null, updated_at timestamptz not null default now()
);
create index hc_billing_contracts_scope on public.hc_billing_contracts(institution_id,username);
create table public.hc_billing_invoices(
 id uuid primary key default gen_random_uuid(),contract_id uuid not null references public.hc_billing_contracts(id),
 institution_id text not null references public.hc_auth_institutions(id),username text,
 account_id uuid references public.hc_billing_accounts(id),period text not null,title text not null,
 amount_cents bigint not null check(amount_cents>0),paid_cents bigint not null default 0 check(paid_cents>=0),
 due_at timestamptz not null,status text not null default 'pending' check(status in('pending','paid','void')),
 checkout_id text,checkout_url text,revision bigint not null default 1,created_at timestamptz not null default now(),
 unique(contract_id,period)
);
create index hc_billing_invoices_scope on public.hc_billing_invoices(institution_id,username,due_at);
create index hc_billing_invoices_contract on public.hc_billing_invoices(contract_id,status,due_at);
create table public.hc_billing_checkouts(id uuid primary key,invoice_id uuid not null references public.hc_billing_invoices(id),account_id uuid not null references public.hc_billing_accounts(id),amount_cents bigint not null check(amount_cents>0),preference_id text,created_at timestamptz not null default now());
create index hc_billing_checkouts_invoice on public.hc_billing_checkouts(invoice_id);
create table public.hc_billing_payments(
 id uuid primary key default gen_random_uuid(),invoice_id uuid not null references public.hc_billing_invoices(id),
 account_id uuid,provider text not null,payment_id text not null,amount_cents bigint not null check(amount_cents>=0),
 status text not null,reference text not null default '',actor text not null,at timestamptz not null default now(),
 unique(provider,payment_id)
);
create index hc_billing_payments_invoice on public.hc_billing_payments(invoice_id);
create table public.hc_billing_messages(id uuid primary key default gen_random_uuid(),institution_id text not null references public.hc_auth_institutions(id),username text,body text not null,actor text not null,created_at timestamptz not null default now());
create index hc_billing_messages_scope on public.hc_billing_messages(institution_id,username,created_at desc);
create table public.hc_accounting_entries(id uuid primary key default gen_random_uuid(),institution_id text not null references public.hc_auth_institutions(id),payload jsonb not null,revision bigint not null default 1,updated_by text not null,updated_at timestamptz not null default now());
create index hc_accounting_entries_scope on public.hc_accounting_entries(institution_id,updated_at desc);
create table public.hc_institution_layouts(institution_id text primary key references public.hc_auth_institutions(id),payload jsonb not null,revision bigint not null default 1,updated_by text not null,updated_at timestamptz not null default now());
create table public.hc_billing_audit(id bigint generated always as identity primary key,table_name text not null,target text not null,institution_id text,actor text not null,at timestamptz not null default now(),before_payload jsonb,after_payload jsonb not null);
create index hc_billing_audit_target on public.hc_billing_audit(table_name,target,at);
do $$ declare n text;begin foreach n in array array['hc_billing_settings','hc_billing_accounts','hc_billing_contracts','hc_billing_invoices','hc_billing_checkouts','hc_billing_payments','hc_billing_messages','hc_accounting_entries','hc_institution_layouts','hc_billing_audit'] loop
 execute format('alter table public.%I enable row level security',n);
 execute format('revoke all on public.%I from anon,authenticated',n);
 execute format('grant select,insert,update on public.%I to service_role',n);
 end loop;end $$;
grant usage,select on sequence public.hc_billing_audit_id_seq to service_role;
revoke update on public.hc_billing_audit from service_role;
create function public.hc284_audit_record() returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
declare b jsonb; a jsonb;begin
 if tg_op='UPDATE' then b=to_jsonb(old);new.revision=old.revision+1;new.updated_at=clock_timestamp();end if;
 a=to_jsonb(new);insert into public.hc_billing_audit(table_name,target,institution_id,actor,before_payload,after_payload)
 values(tg_table_name,coalesce(a->>'id',a->>'institution_id'),a->>'institution_id',coalesce(a->>'updated_by','server'),b,a);return new;
end $$;
revoke all on function public.hc284_audit_record() from public,anon,authenticated;
do $$ declare n text;begin foreach n in array array['hc_billing_accounts','hc_billing_contracts','hc_accounting_entries','hc_institution_layouts'] loop
 execute format('create trigger hc284_audit before insert or update on public.%I for each row execute function public.hc284_audit_record()',n);end loop;end $$;
create function public.hc284_apply_payment(p_invoice uuid,p_account uuid,p_provider text,p_payment_id text,p_amount bigint,p_status text,p_reference text,p_actor text)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare inv public.hc_billing_invoices;existing public.hc_billing_payments;total bigint;begin
 select * into inv from public.hc_billing_invoices where id=p_invoice for update;if not found or inv.status='void' then raise exception 'Liquidación no disponible';end if;
 if p_amount<0 or p_payment_id='' or p_provider not in('mercadopago','manual') then raise exception 'Pago inválido';end if;
 select * into existing from public.hc_billing_payments where provider=p_provider and payment_id=p_payment_id;
 if found and existing.invoice_id<>p_invoice then raise exception 'El pago pertenece a otra liquidación';end if;
 if found and p_provider='manual' then
  if existing.amount_cents<>p_amount or existing.status<>p_status then raise exception 'Ese comprobante ya fue registrado con otro importe';end if;
  return to_jsonb(inv);
 end if;
 if p_provider='manual' and not found and p_amount>greatest(0,inv.amount_cents-inv.paid_cents) then raise exception 'El importe supera el saldo';end if;
 insert into public.hc_billing_payments(invoice_id,account_id,provider,payment_id,amount_cents,status,reference,actor)
 values(p_invoice,p_account,p_provider,p_payment_id,p_amount,p_status,p_reference,p_actor)
 on conflict(provider,payment_id) do update set amount_cents=excluded.amount_cents,status=excluded.status,reference=excluded.reference,actor=excluded.actor,at=now() where hc_billing_payments.invoice_id=excluded.invoice_id;
 if not found then raise exception 'El pago pertenece a otra liquidación';end if;
 select coalesce(sum(amount_cents),0) into total from public.hc_billing_payments where invoice_id=p_invoice and status='approved';
 update public.hc_billing_invoices set paid_cents=total,status=case when total>=amount_cents then 'paid' else 'pending' end,checkout_id=null,checkout_url=null,revision=revision+1 where id=p_invoice returning * into inv;
 insert into public.hc_billing_audit(table_name,target,institution_id,actor,after_payload) values('hc_billing_payments',p_payment_id,inv.institution_id,p_actor,jsonb_build_object('invoice',p_invoice,'amount',p_amount,'status',p_status,'provider',p_provider));
 return to_jsonb(inv);end $$;
revoke all on function public.hc284_apply_payment(uuid,uuid,text,text,bigint,text,text,text) from public,anon,authenticated;
grant execute on function public.hc284_apply_payment(uuid,uuid,text,text,bigint,text,text,text) to service_role;
create function public.hc284_access_mode(p_data_id text,p_username text) returns text language sql stable security invoker set search_path=pg_catalog,public as $$
 select case when exists(
 select 1 from public.hc_billing_contracts c join public.hc_auth_institutions i on i.id=c.institution_id
 where coalesce(i.data_institution_id,i.id)=p_data_id and (c.username is null or c.username=p_username)
 and coalesce((c.payload->>'enabled')::boolean,false) and (
 c.payload->>'serviceState'='read_only' or (
 coalesce((c.payload->>'autoRestrict')::boolean,false) and coalesce((select (payload->>'collectionEnabled')::boolean from public.hc_billing_settings where key='main'),false)
 and exists(select 1 from public.hc_billing_invoices v where v.contract_id=c.id and v.status='pending' and v.paid_cents<v.amount_cents and v.due_at+make_interval(days=>coalesce((c.payload->>'graceDays')::int,7))<now())
 ))) then 'ro' else 'rw' end;
$$;
revoke all on function public.hc284_access_mode(text,text) from public,anon,authenticated;
grant execute on function public.hc284_access_mode(text,text) to service_role;
create function public.hc284_save_layout(p_institution text,p_actor text,p_expected bigint,p_payload jsonb) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare inst public.hc_auth_institutions;layout public.hc_institution_layouts;reg jsonb;current_beds jsonb;wanted jsonb;all_beds jsonb;r jsonb;id text;begin
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
revoke all on function public.hc284_save_layout(text,text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.hc284_save_layout(text,text,bigint,jsonb) to service_role;
create function public.hc284_protect_layout() returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
declare cfg jsonb;begin
 if new.bucket not in('registry','beds') then return new;end if;
 select l.payload into cfg from public.hc_institution_layouts l join public.hc_auth_institutions i on i.id=l.institution_id where coalesce(i.data_institution_id,i.id)=new.institution_id limit 1;
 if cfg is null then return new;end if;
 if new.bucket='registry' and exists(select 1 from jsonb_array_elements(coalesce(new.payload->'value','[]')) x where coalesce((x->>'active')::boolean,true) and coalesce(x->>'bedId','')<>'' and not exists(select 1 from jsonb_array_elements(cfg->'beds') b where b->>'id'=x->>'bedId')) then raise exception 'La cama ya no está habilitada. Actualizá el censo';end if;
 if new.bucket='beds' and exists(select 1 from jsonb_array_elements(coalesce(new.payload->'value','[]')) x where not coalesce((x->>'retired')::boolean,false) and not exists(select 1 from jsonb_array_elements(cfg->'beds') b where b->>'id'=x->>'id' and b->>'area'=x->>'area' and b->>'label'=coalesce(x->>'label',x->>'bed'))) then raise exception 'Los servicios y camas se modifican desde Institución';end if;
 return new;end $$;
revoke all on function public.hc284_protect_layout() from public,anon,authenticated;
create trigger hc284_protect_layout before insert or update on public.hc_state for each row execute function public.hc284_protect_layout();
