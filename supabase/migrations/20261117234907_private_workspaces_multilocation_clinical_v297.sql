begin;
alter table public.hc_tele_profiles add column display_name text not null default '';
alter table public.hc_tele_profiles add column bank_public jsonb not null default '{"visible":false}';
alter table public.hc_tele_visits add column location_snapshot text not null default '';
alter table public.hc_tele_visits add column payment_model text not null default 'legacy_office_deposit' check(payment_model in('legacy_office_deposit','split_full'));
alter table public.hc_tele_oauth add column purpose text not null default 'professional' check(purpose in('professional','platform'));
create table public.hc_tele_platform_account(id boolean primary key default true check(id),collector_id text not null,verified_by text not null,verified_at timestamptz not null default now());
create table public.hc_tele_notes(visit_id uuid primary key references public.hc_tele_visits(id),provider text not null references public.hc_auth_users(username),client text not null references public.hc_portal_clients(username),record jsonb not null default '{}',revision integer not null default 1,updated_at timestamptz not null default now());
create index hc297_notes_patient on public.hc_tele_notes(provider,client,updated_at desc);
create index hc297_notes_client_fk on public.hc_tele_notes(client);
create table public.hc_tele_note_versions(visit_id uuid not null references public.hc_tele_visits(id),revision integer not null,author text not null,record jsonb not null,created_at timestamptz not null default now(),primary key(visit_id,revision));
do $$declare t text;begin foreach t in array array['hc_tele_platform_account','hc_tele_notes','hc_tele_note_versions'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant all on public.%I to service_role',t);end loop;end$$;
create or replace function public.hc297_save_note(actor_name text,visit uuid,expected_revision integer,entry jsonb) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare v hc_tele_visits;n hc_tele_notes;
begin
 select * into v from hc_tele_visits where id=visit for update;
 if not found or v.provider<>actor_name then raise exception 'Sin acceso a la historia clínica';end if;
 if v.status not in('confirmed','active','finished') then raise exception 'La reserva no admite anotaciones clínicas';end if;
 if jsonb_typeof(entry)<>'object' or octet_length(entry::text)>100000 then raise exception 'Registro clínico inválido';end if;
 select * into n from hc_tele_notes where visit_id=visit;
 if coalesce(n.revision,0)<>expected_revision then raise exception 'La historia cambió en otro equipo. Volvé a cargarla antes de guardar';end if;
 insert into hc_tele_notes(visit_id,provider,client,record,revision) values(visit,actor_name,v.client,entry,1)
 on conflict(visit_id) do update set record=excluded.record,revision=hc_tele_notes.revision+1,updated_at=now() returning * into n;
 insert into hc_tele_note_versions(visit_id,revision,author,record) values(visit,n.revision,actor_name,entry);return to_jsonb(n);
end$$;
create or replace function public.hc297_reserve(who text,patient text,mode_name text,at_start timestamptz,duration integer,request_key uuid,visit_reason text,expected_revision integer,expected_trial boolean) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare p hc_tele_profiles;s hc_tele_settings;v hc_tele_visits;d jsonb;r jsonb;amount bigint;fee bigint;at_end timestamptz;clock time;daykey text;trial boolean;w jsonb;loc text;
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
 insert into hc_tele_visits(request_id,provider,client,mode,starts_at,ends_at,minutes,total_cents,platform_cents,provider_cents,commission_bps,reason,policy_snapshot,profile_revision,is_trial,status,location_snapshot,payment_model) values(request_key,who,patient,mode_name,at_start,at_end,duration,amount,fee,amount-fee,case when trial then 0 else s.commission_bps end,left(visit_reason,1000),case when trial then 'Consulta de prueba gratuita, sin cobros posteriores para esta reserva.' else s.cancellation_policy end,p.revision,trial,case when trial then 'confirmed' else 'awaiting_payment' end,loc,'split_full') returning * into v;
 if not trial then insert into hc_tele_payments(visit_id,kind,minutes,amount_cents,platform_cents,provider_cents,status,provider_approved) values(v.id,'initial',duration,amount,fee,amount-fee,'offered',true);end if;
 return to_jsonb(v);
end$$;
create or replace function public.hc297_available_slots(who text,mode_name text,day_date date,duration integer) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare p hc_tele_profiles;d jsonb;n integer;last_min integer;st timestamptz;en timestamptz;free boolean;out jsonb='[]';w jsonb;
begin
select * into p from hc_tele_profiles where username=who and public_visible;
if p.username is null or mode_name not in('telemedicine','office') or not coalesce((p.modes->mode_name->>'enabled')::boolean,false) then raise exception 'Modalidad no publicada';end if;
if day_date<current_date-1 or day_date>current_date+90 or not exists(select 1 from jsonb_array_elements(p.modes->mode_name->'rates') r where (r->>'minutes')::integer=duration) then raise exception 'Fecha o duración no disponible';end if;
d=p.modes->mode_name->'weekly'->'days'->extract(dow from day_date)::integer::text;
if not coalesce((d->>'active')::boolean,false) then return out;end if;
for w in select value from jsonb_array_elements(coalesce(d->'windows',jsonb_build_array(jsonb_build_object('start',d->>'start','end',d->>'end','address',p.address)))) loop
n=extract(hour from(w->>'start')::time)::integer*60+extract(minute from(w->>'start')::time)::integer;last_min=extract(hour from(w->>'end')::time)::integer*60+extract(minute from(w->>'end')::time)::integer;
while n+duration<=last_min loop
st=(day_date::timestamp+make_interval(mins=>n)) at time zone 'America/Argentina/Buenos_Aires';en=st+make_interval(mins=>duration);n=n+15;if st<=now() then continue;end if;
free=true;begin perform hc292_assert_free(who,st,en);exception when others then free=false;end;
out=out||jsonb_build_array(jsonb_build_object('start',st,'local',to_char(st at time zone 'America/Argentina/Buenos_Aires','YYYY-MM-DD"T"HH24:MI'),'available',free,'address',case when mode_name='office' then coalesce(w->>'address',p.address) else '' end,'location',coalesce(w->>'location','')));
end loop;end loop;return out;
end$$;

revoke all on function public.hc297_reserve(text,text,text,timestamptz,integer,uuid,text,integer,boolean),public.hc297_available_slots(text,text,date,integer),public.hc297_save_note(text,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.hc297_reserve(text,text,text,timestamptz,integer,uuid,text,integer,boolean),public.hc297_available_slots(text,text,date,integer),public.hc297_save_note(text,uuid,integer,jsonb) to service_role;
commit;
