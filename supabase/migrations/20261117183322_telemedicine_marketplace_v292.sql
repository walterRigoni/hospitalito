-- v292. Server-only marketplace; the browser never controls money or entitlement.
begin;
create table if not exists public.hc_tele_profiles(
 username text primary key references public.hc_auth_users(username),
 role text not null,specialty text not null,description text not null default '',credential text not null default '',address text not null default '',
 modes jsonb not null default '{}',public_visible boolean not null default false,revision integer not null default 1,updated_at timestamptz not null default now()
);
create table if not exists public.hc_tele_settings(
 id boolean primary key default true check(id),enabled boolean not null default false,
 commission_bps integer check(commission_bps between 1 and 9999),cancellation_policy text not null default '',revision integer not null default 1,updated_by text,updated_at timestamptz not null default now()
);
insert into public.hc_tele_settings(id) values(true) on conflict do nothing;
create table if not exists public.hc_tele_sellers(
 username text primary key references public.hc_auth_users(username),collector_id text not null,encrypted_tokens text not null,expires_at timestamptz not null,updated_at timestamptz not null default now()
);
create table if not exists public.hc_tele_oauth(
 state_hash text primary key,username text not null references public.hc_auth_users(username),expires_at timestamptz not null,used_at timestamptz
);
create table if not exists public.hc_tele_visits(
 id uuid primary key default gen_random_uuid(),request_id uuid not null,provider text not null references public.hc_tele_profiles(username),client text not null references public.hc_portal_clients(username),
 mode text not null check(mode in('telemedicine','office')),starts_at timestamptz not null,ends_at timestamptz not null check(ends_at>starts_at),
 minutes integer not null check(minutes in(15,30,45,60)),total_cents bigint not null check(total_cents>0),platform_cents bigint not null check(platform_cents>0),provider_cents bigint not null check(provider_cents>=0),commission_bps integer not null check(commission_bps between 1 and 9999),
 status text not null default 'awaiting_payment' check(status in('awaiting_payment','confirmed','active','finished','cancelled','expired','payment_review')),
 hold_until timestamptz not null default now()+interval '10 minutes',reason text not null default '',
 active_at timestamptz,finished_at timestamptz,last_tick timestamptz,consumed_seconds numeric not null default 0,
 client_seen timestamptz,provider_seen timestamptz,client_connected boolean not null default false,provider_connected boolean not null default false,
 policy_snapshot text not null,profile_revision integer not null,requested_minutes integer check(requested_minutes in(15,30,45,60)),created_at timestamptz not null default now(),unique(client,request_id)
);
create index if not exists hc_tele_visits_provider_time on public.hc_tele_visits(provider,starts_at);
create index if not exists hc_tele_visits_client_time on public.hc_tele_visits(client,starts_at desc);
create table if not exists public.hc_tele_payments(
 id uuid primary key default gen_random_uuid(),visit_id uuid not null references public.hc_tele_visits(id),kind text not null check(kind in('initial','extension')),
 minutes integer not null check(minutes in(15,30,45,60)),amount_cents bigint not null check(amount_cents>0),platform_cents bigint not null,provider_cents bigint not null,
 status text not null default 'offered' check(status in('offered','pending','approved','rejected','refunded','review','expired')),consented_at timestamptz,
 collector_id text,preference_id text,checkout_url text,payment_id text unique,applied boolean not null default false,expires_at timestamptz not null default now()+interval '10 minutes',
 hold_end timestamptz,provider_approved boolean not null default false,created_at timestamptz not null default now()
);
create unique index if not exists hc_tele_payment_initial on public.hc_tele_payments(visit_id) where kind='initial';
create unique index if not exists hc_tele_extension_open on public.hc_tele_payments(visit_id) where kind='extension' and status in('offered','pending');
create table if not exists public.hc_tele_signals(
 id bigint generated always as identity primary key,visit_id uuid not null references public.hc_tele_visits(id),sender text not null check(sender in('client','provider')),kind text not null check(kind in('offer','answer','ice','restart')),payload jsonb not null,created_at timestamptz not null default now()
);
create index if not exists hc_tele_signal_visit on public.hc_tele_signals(visit_id,id);
create table if not exists public.hc_tele_documents(
 id uuid primary key default gen_random_uuid(),visit_id uuid not null references public.hc_tele_visits(id),author text not null,kind text not null check(kind in('prescription','certificate','preoperative','report')),
 name text not null,path text not null,mime text not null,published_at timestamptz not null default now()
);
create table if not exists public.hc_tele_refund_requests(
 payment_id uuid primary key references public.hc_tele_payments(id),requested_by text not null,reason text not null,status text not null default 'pending' check(status in('pending','resolved')),created_at timestamptz not null default now()
);
create table if not exists public.hc_tele_payment_events(
 payment_id text primary key,payment_ref uuid not null references public.hc_tele_payments(id),amount_cents bigint not null,provider_status text not null,review_reason text not null default '',updated_at timestamptz not null default now()
);
do $$declare n text;begin foreach n in array array['hc_tele_profiles','hc_tele_settings','hc_tele_sellers','hc_tele_oauth','hc_tele_visits','hc_tele_payments','hc_tele_signals','hc_tele_documents','hc_tele_refund_requests'] loop
 execute format('alter table public.%I enable row level security',n);
 execute format('revoke all on public.%I from public,anon,authenticated',n);
 execute format('grant all on public.%I to service_role',n);
end loop;end$$;
alter table public.hc_tele_payment_events enable row level security;
revoke all on public.hc_tele_payment_events from public,anon,authenticated;
grant all on public.hc_tele_payment_events to service_role;
grant usage,select on sequence public.hc_tele_signals_id_seq to service_role;

create or replace function public.hc292_reserved_end(v public.hc_tele_visits) returns timestamptz language sql stable security invoker set search_path=public,pg_temp as $$
 select greatest(v.ends_at,coalesce((select max(p.hold_end) from public.hc_tele_payments p where p.visit_id=v.id and (p.status='approved' or p.status in('offered','pending') and p.expires_at>now())),v.ends_at),coalesce(v.active_at+make_interval(secs=>v.minutes*60+coalesce((select sum(p.minutes*60) from public.hc_tele_payments p where p.visit_id=v.id and p.kind='extension' and p.status='approved' and p.applied),0)::integer),v.ends_at))
$$;
create or replace function public.hc292_assert_free(who text,at_start timestamptz,at_end timestamptz,exclude_id uuid default null) returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare legacy jsonb;ap jsonb;old_start timestamptz;old_end timestamptz;
begin
 perform pg_advisory_xact_lock(hashtextextended('hc289-provider:'||who,0));
 if exists(select 1 from hc_tele_visits v where v.provider=who and v.id is distinct from exclude_id and (v.status in('confirmed','active') or v.status='awaiting_payment' and v.hold_until>now()) and v.starts_at<at_end and hc292_reserved_end(v)>at_start) then raise exception 'El horario acaba de ocuparse';end if;
 if exists(select 1 from hc_portal_bookings b join hc_portal_providers p on p.id=b.provider_id where p.username=who and b.status in('pending','confirmed') and b.starts_at<at_end and b.ends_at>at_start) or exists(select 1 from hc_portal_blocks b join hc_portal_providers p on p.id=b.provider_id where p.username=who and b.starts_at<at_end and b.ends_at>at_start) then raise exception 'Hay un turno o bloqueo institucional';end if;
 for legacy in select s.payload->'value' from hc_state s where s.bucket='appointments' and not s.deleted and s.institution_id in(select i.data_institution_id from hc_auth_memberships m join hc_auth_institutions i on i.id=m.institution_id where m.username=who and m.active and i.active) loop
 if jsonb_typeof(legacy)<>'array' then continue;end if;
 for ap in select value from jsonb_array_elements(legacy) loop
 if ap->>'doctorId'<>who or coalesce(ap->>'status','') in('cancelado','cancelled','anulado') then continue;end if;
 begin old_start=((ap->>'date')||'T'||(ap->>'time'))::timestamp at time zone 'America/Argentina/Buenos_Aires';old_end=old_start+make_interval(mins=>greatest(1,least(240,coalesce(nullif(ap->>'durationMinutes','')::integer,nullif(ap->>'minutes','')::integer,30))));
 if old_start<at_end and old_end>at_start then raise exception using errcode='23P01',message='Horario ocupado en el turnero';end if;
 exception when invalid_text_representation or invalid_datetime_format then null;end;
 end loop;end loop;
end$$;
create or replace function public.hc292_reserve(who text,patient text,mode_name text,at_start timestamptz,duration integer,request_key uuid,visit_reason text,expected_revision integer) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare p hc_tele_profiles;s hc_tele_settings;v hc_tele_visits;d jsonb;r jsonb;amount bigint;fee bigint;at_end timestamptz;clock time;daykey text;
begin
 perform pg_advisory_xact_lock(hashtextextended('hc289-provider:'||who,0));
 select * into v from hc_tele_visits where client=patient and request_id=request_key;if found then return to_jsonb(v);end if;
 select * into p from hc_tele_profiles where username=who and public_visible;
 if not found or p.revision<>expected_revision then raise exception 'El perfil cambió. Actualizá los precios y horarios';end if;
 if not exists(select 1 from hc_auth_users u join hc_auth_memberships m on m.username=u.username join hc_auth_institutions i on i.id=m.institution_id where u.username=who and u.active and m.active and i.active and m.role=p.role) then raise exception 'Profesional no habilitado';end if;
 if mode_name not in('telemedicine','office') or not coalesce((p.modes->mode_name->>'enabled')::boolean,false) then raise exception 'Modalidad no publicada';end if;
 select * into s from hc_tele_settings where id;
 if not s.enabled or s.commission_bps is null or s.cancellation_policy='' then raise exception 'Los cobros todavía no están habilitados por Hospitalito';end if;
 daykey=extract(dow from at_start at time zone 'America/Argentina/Buenos_Aires')::integer::text;d=p.modes->mode_name->'weekly'->'days'->daykey;clock=(at_start at time zone 'America/Argentina/Buenos_Aires')::time;at_end=at_start+make_interval(mins=>duration);
 if duration not in(15,30,45,60) or at_start<now() or at_start>now()+interval '90 days' or not coalesce((d->>'active')::boolean,false) or clock<(d->>'start')::time or (at_end at time zone 'America/Argentina/Buenos_Aires')::date<>(at_start at time zone 'America/Argentina/Buenos_Aires')::date or (at_end at time zone 'America/Argentina/Buenos_Aires')::time>(d->>'end')::time or mod(extract(epoch from(clock-(d->>'start')::time))::integer,900)<>0 then raise exception 'Horario fuera de la disponibilidad publicada';end if;
 select value into r from jsonb_array_elements(p.modes->mode_name->'rates') where (value->>'minutes')::integer=duration;amount=(r->>'amount_cents')::bigint;
 if amount is null or amount<100 then raise exception 'Ese precio no está publicado';end if;
 fee=round(amount*s.commission_bps/10000.0);if fee<1 or fee>=amount then raise exception 'Comisión incompatible con el precio';end if;
 perform hc292_assert_free(who,at_start,at_end);
 insert into hc_tele_visits(request_id,provider,client,mode,starts_at,ends_at,minutes,total_cents,platform_cents,provider_cents,commission_bps,reason,policy_snapshot,profile_revision) values(request_key,who,patient,mode_name,at_start,at_end,duration,amount,fee,amount-fee,s.commission_bps,left(visit_reason,1000),s.cancellation_policy,p.revision) returning * into v;
 insert into hc_tele_payments(visit_id,kind,minutes,amount_cents,platform_cents,provider_cents,status,provider_approved) values(v.id,'initial',duration,case when mode_name='office' then fee else amount end,fee,case when mode_name='office' then 0 else amount-fee end,'offered',true);
 return to_jsonb(v);
end$$;
create or replace function public.hc292_tick(visit uuid,side_name text,is_connected boolean) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare v hc_tele_visits;entitled integer;elapsed numeric;at_now timestamptz=clock_timestamp();both_live boolean;
begin
 select provider into v.provider from hc_tele_visits where id=visit;
 perform pg_advisory_xact_lock(hashtextextended('hc289-provider:'||v.provider,0));
 select * into v from hc_tele_visits where id=visit for update;if not found then raise exception 'Consulta no encontrada';end if;
 entitled=v.minutes*60+coalesce((select sum(minutes*60) from hc_tele_payments where visit_id=v.id and kind='extension' and status='approved' and applied),0);
 both_live=v.client_connected and v.provider_connected and v.client_seen>at_now-interval '12 seconds' and v.provider_seen>at_now-interval '12 seconds';
 if v.status='active' and v.last_tick is not null and both_live then v.consumed_seconds=least(entitled,v.consumed_seconds+greatest(0,least(8,extract(epoch from(at_now-v.last_tick)))));end if;
 if side_name='client' then v.client_seen=at_now;v.client_connected=is_connected;elsif side_name='provider' then v.provider_seen=at_now;v.provider_connected=is_connected;else raise exception 'Participante inválido';end if;
 both_live=v.client_connected and v.provider_connected and v.client_seen>at_now-interval '12 seconds' and v.provider_seen>at_now-interval '12 seconds';
 if v.mode='telemedicine' and v.status='confirmed' and both_live then
  if at_now<v.starts_at-interval '10 minutes' or at_now>v.ends_at then raise exception 'La consulta está fuera del horario reservado';end if;
  perform hc292_assert_free(v.provider,v.starts_at,at_now+make_interval(mins=>v.minutes),v.id);
  v.status='active';v.active_at=at_now;
 end if;
 update hc_tele_visits set status=v.status,active_at=v.active_at,consumed_seconds=v.consumed_seconds,last_tick=at_now,client_seen=v.client_seen,provider_seen=v.provider_seen,client_connected=v.client_connected,provider_connected=v.provider_connected where id=v.id;
 return jsonb_build_object('status',v.status,'remaining',greatest(0,entitled-v.consumed_seconds),'connected',both_live,'serverNow',at_now,'activeAt',v.active_at,'entitledSeconds',entitled);
end$$;

create or replace function public.hc292_institution_conflicts() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare who text;ap jsonb;at_start timestamptz;at_end timestamptz;
begin
 if tg_table_name='hc_state' then
  if new.bucket<>'appointments' or new.deleted or jsonb_typeof(new.payload->'value')<>'array' then return new;end if;
  for who in select distinct value->>'doctorId' from jsonb_array_elements(new.payload->'value') where coalesce(value->>'doctorId','')<>'' order by 1 loop perform pg_advisory_xact_lock(hashtextextended('hc289-provider:'||who,0));end loop;
  for ap in select value from jsonb_array_elements(new.payload->'value') loop
   if coalesce(ap->>'status','') in('cancelado','cancelled','anulado') then continue;end if;
   begin who=ap->>'doctorId';at_start=((ap->>'date')||'T'||(ap->>'time'))::timestamp at time zone 'America/Argentina/Buenos_Aires';at_end=at_start+make_interval(mins=>greatest(1,least(240,coalesce(nullif(ap->>'durationMinutes','')::integer,nullif(ap->>'minutes','')::integer,30))));
   if exists(select 1 from hc_tele_visits v where v.provider=who and (v.status in('confirmed','active') or v.status='awaiting_payment' and v.hold_until>now()) and v.starts_at<at_end and hc292_reserved_end(v)>at_start) then raise exception 'Horario reservado para telemedicina o consultorio';end if;
   exception when invalid_text_representation or invalid_datetime_format then null;end;
  end loop;
 else
  if tg_table_name='hc_portal_bookings' then if new.status not in('pending','confirmed') then return new;end if;end if;
  select username into who from hc_portal_providers where id=new.provider_id;perform pg_advisory_xact_lock(hashtextextended('hc289-provider:'||who,0));
  if exists(select 1 from hc_tele_visits v where v.provider=who and (v.status in('confirmed','active') or v.status='awaiting_payment' and v.hold_until>now()) and v.starts_at<new.ends_at and hc292_reserved_end(v)>new.starts_at) then raise exception 'Horario reservado para telemedicina o consultorio';end if;
 end if;return new;
end$$;
create trigger hc292_portal_booking_conflict before insert or update on public.hc_portal_bookings for each row execute function public.hc292_institution_conflicts();
create trigger hc292_portal_block_conflict before insert or update on public.hc_portal_blocks for each row execute function public.hc292_institution_conflicts();
create trigger hc292_legacy_conflict before insert or update on public.hc_state for each row execute function public.hc292_institution_conflicts();
revoke all on function public.hc292_reserved_end(public.hc_tele_visits),public.hc292_assert_free(text,timestamptz,timestamptz,uuid),public.hc292_reserve(text,text,text,timestamptz,integer,uuid,text,integer),public.hc292_tick(uuid,text,boolean),public.hc292_institution_conflicts() from public,anon,authenticated;
grant execute on function public.hc292_reserved_end(public.hc_tele_visits),public.hc292_assert_free(text,timestamptz,timestamptz,uuid),public.hc292_reserve(text,text,text,timestamptz,integer,uuid,text,integer),public.hc292_tick(uuid,text,boolean),public.hc292_institution_conflicts() to service_role;

create or replace function public.hc292_offer_extension(visit uuid,duration integer) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare v hc_tele_visits;p hc_tele_profiles;r jsonb;payment hc_tele_payments;extra integer;amount bigint;fee bigint;finish timestamptz;d jsonb;
begin
 select provider into v.provider from hc_tele_visits where id=visit;perform pg_advisory_xact_lock(hashtextextended('hc289-provider:'||v.provider,0));
 select * into v from hc_tele_visits where id=visit for update;
 if v.status<>'active' or v.mode<>'telemedicine' or duration not in(15,30,45,60) then raise exception 'La consulta no admite una extensión';end if;
 update hc_tele_payments set status='expired' where visit_id=visit and kind='extension' and status in('offered','pending') and expires_at<=now();
 if exists(select 1 from hc_tele_payments where visit_id=visit and kind='extension' and status in('offered','pending')) then raise exception 'Ya hay una extensión ofrecida';end if;
 select * into p from hc_tele_profiles where username=v.provider;
 select value into r from jsonb_array_elements(p.modes->'telemedicine'->'rates') where (value->>'minutes')::integer=duration;amount=(r->>'amount_cents')::bigint;
 if amount is null or amount<100 then raise exception 'No hay precio publicado para esa duración';end if;
 select coalesce(sum(minutes),0) into extra from hc_tele_payments where visit_id=visit and kind='extension' and status='approved' and applied;
 if v.minutes+extra+duration>240 then raise exception 'Finalizá esta consulta y reservá otra';end if;
 finish=greatest(v.ends_at,v.active_at+make_interval(mins=>v.minutes+extra))+make_interval(mins=>duration);
 d=p.modes->'telemedicine'->'weekly'->'days'->extract(dow from finish at time zone 'America/Argentina/Buenos_Aires')::integer::text;
 if not coalesce((d->>'active')::boolean,false) or (finish at time zone 'America/Argentina/Buenos_Aires')::date<>(v.starts_at at time zone 'America/Argentina/Buenos_Aires')::date or (finish at time zone 'America/Argentina/Buenos_Aires')::time>(d->>'end')::time then raise exception 'La extensión supera la disponibilidad publicada';end if;
 perform hc292_assert_free(v.provider,v.starts_at,finish,v.id);
 fee=round(amount*v.commission_bps/10000.0);
 insert into hc_tele_payments(visit_id,kind,minutes,amount_cents,platform_cents,provider_cents,provider_approved,hold_end,expires_at) values(visit,'extension',duration,amount,fee,amount-fee,true,finish,now()+interval '5 minutes') returning * into payment;
 update hc_tele_visits set requested_minutes=null where id=visit;
 return to_jsonb(payment);
end$$;
create or replace function public.hc292_apply_tele_payment(payment uuid,external_id text,paid_amount bigint,collector text,provider_status text,refunded bigint default 0) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare p hc_tele_payments;v hc_tele_visits;review text='';
begin
 select v0.provider into v.provider from hc_tele_visits v0 join hc_tele_payments p0 on p0.visit_id=v0.id where p0.id=payment;
 perform pg_advisory_xact_lock(hashtextextended('hc289-provider:'||v.provider,0));
 select * into p from hc_tele_payments where id=payment for update;select * into v from hc_tele_visits where id=p.visit_id for update;
 if p.id is null or p.collector_id is distinct from collector or p.amount_cents<>paid_amount then raise exception 'El pago no coincide con el importe o destinatario';end if;
 if p.payment_id is not null and p.payment_id<>external_id then review='Pago duplicado: requiere reintegro';
 elsif provider_status='approved' and refunded=0 and not p.applied then
  if v.status in('cancelled','expired','finished','payment_review') or p.expires_at<now() or p.consented_at is null or not p.provider_approved or p.kind='initial' and v.hold_until<now() then review='Pago fuera de la reserva: requiere revisión y reintegro';
  else
   perform hc292_assert_free(v.provider,v.starts_at,greatest(v.ends_at,coalesce(p.hold_end,v.ends_at)),v.id);
   update hc_tele_payments set status='approved',payment_id=external_id,applied=true where id=p.id;
   if p.kind='initial' then update hc_tele_visits set status='confirmed' where id=v.id;end if;
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
revoke all on function public.hc292_offer_extension(uuid,integer),public.hc292_apply_tele_payment(uuid,text,bigint,text,text,bigint) from public,anon,authenticated;
grant execute on function public.hc292_offer_extension(uuid,integer),public.hc292_apply_tele_payment(uuid,text,bigint,text,text,bigint) to service_role;
commit;
