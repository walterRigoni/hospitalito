-- Client portal: private records, custom authenticated Edge Function only.
create table public.hc_portal_clients (
 username text primary key references public.hc_auth_users(username),
 legal_name text not null, dni text not null check(dni ~ '^[0-9]{6,9}$'), dob date not null,
 document_path text not null, profile jsonb not null default '{}',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index hc_portal_clients_dni on public.hc_portal_clients(dni);
create table public.hc_portal_institutions (
 institution_id text primary key references public.hc_auth_institutions(id),
 enabled boolean not null default false,address text not null default '',
 latitude double precision check(latitude between -90 and 90),longitude double precision check(longitude between -180 and 180),
 phone text not null default '',external_connected boolean not null default false,updated_at timestamptz not null default now()
);
create table public.hc_portal_verifications (
 username text not null references public.hc_portal_clients(username),institution_id text not null references public.hc_auth_institutions(id),
 status text not null default 'pending' check(status in ('pending','verified','rejected','revoked')),
 patient_id text not null default '',reviewed_by text not null default '',reviewed_at timestamptz,note text not null default '',
 created_at timestamptz not null default now(),primary key(username,institution_id)
);
create index hc_portal_verifications_scope on public.hc_portal_verifications(institution_id,status,created_at desc);
create unique index hc_portal_one_identity_per_patient on public.hc_portal_verifications(institution_id,patient_id) where status='verified' and patient_id<>'';
create table public.hc_portal_providers (
 id uuid primary key default gen_random_uuid(),username text not null references public.hc_auth_users(username),
 institution_id text not null references public.hc_auth_institutions(id),public_visible boolean not null default false,
 specialty text not null default '',description text not null default '',telemedicine boolean not null default false,
 private_practice boolean not null default false,address text not null default '',
 weekly jsonb not null default '{"days":{}}',updated_at timestamptz not null default now(),
 unique(username,institution_id,private_practice)
);
create index hc_portal_directory on public.hc_portal_providers(institution_id,public_visible);
create table public.hc_portal_blocks (
 id uuid primary key default gen_random_uuid(),provider_id uuid not null references public.hc_portal_providers(id),
 starts_at timestamptz not null,ends_at timestamptz not null,source text not null default 'manual' check(source in ('manual','external')),
 note text not null default '',created_by text not null,created_at timestamptz not null default now(),
 check(ends_at>starts_at)
);
create index hc_portal_blocks_dates on public.hc_portal_blocks(provider_id,starts_at,ends_at);
create table public.hc_portal_bookings (
 id uuid primary key default gen_random_uuid(),provider_id uuid not null references public.hc_portal_providers(id),
 username text not null references public.hc_portal_clients(username),starts_at timestamptz not null,ends_at timestamptz not null,
 status text not null default 'pending' check(status in ('pending','confirmed','cancelled','attended')),
 reason text not null default '',telemedicine boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(ends_at>starts_at and ends_at<=starts_at+interval '4 hours')
);
create index hc_portal_bookings_patient on public.hc_portal_bookings(username,starts_at desc);
create index hc_portal_bookings_provider on public.hc_portal_bookings(provider_id,starts_at,ends_at) where status in ('pending','confirmed');
create table public.hc_portal_orders (
 id uuid primary key default gen_random_uuid(),institution_id text not null references public.hc_auth_institutions(id),username text not null references public.hc_portal_clients(username),
 kind text not null check(kind in ('lab','micro','image')),requested_text text not null,requested_by text not null,
 status text not null default 'requested' check(status in ('requested','draft','published','cancelled')),
 report_text text not null default '',report_files jsonb not null default '[]',draft_text text,draft_files jsonb not null default '[]',reported_by text not null default '',published_at timestamptz,
 revision integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index hc_portal_orders_staff on public.hc_portal_orders(institution_id,kind,status,created_at desc);
create index hc_portal_orders_client on public.hc_portal_orders(username,status,published_at desc);
create table public.hc_portal_report_versions (
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.hc_portal_orders(id),revision integer not null,
 report_text text not null,report_files jsonb not null default '[]',status text not null,author text not null,created_at timestamptz not null default now(),unique(order_id,revision)
);
create table public.hc_portal_audit (
 id bigint generated always as identity primary key,actor text not null,action text not null,institution_id text not null default '',
 subject text not null default '',detail jsonb not null default '{}',created_at timestamptz not null default now()
);
create index hc_portal_audit_scope on public.hc_portal_audit(institution_id,created_at desc);
create table public.hc_portal_rate_limits (
 key_hash text primary key,window_at timestamptz not null default now(),hits integer not null default 1
);
do $$declare t text;begin
 foreach t in array array['hc_portal_clients','hc_portal_institutions','hc_portal_verifications','hc_portal_providers','hc_portal_blocks','hc_portal_bookings','hc_portal_orders','hc_portal_report_versions','hc_portal_audit','hc_portal_rate_limits'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select,insert,update,delete on public.%I to service_role',t);
 end loop;
end$$;
grant usage,select on sequence public.hc_portal_audit_id_seq to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('hospitalito-portal-private','hospitalito-portal-private',false,5000000,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=5000000,allowed_mime_types=excluded.allowed_mime_types;

-- The slot check runs for every write, under the professional's transaction lock.
create or replace function public.hc289_booking_guard() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare p public.hc_portal_providers; v_day date; v_clock time; v_end time; d jsonb; span integer; daynum text;
 legacy jsonb; ap jsonb; old_start timestamptz; old_end timestamptz; dataid text; instactive boolean; native jsonb;
begin
 if new.status not in ('pending','confirmed') then return new; end if;
 select * into p from public.hc_portal_providers where id=new.provider_id;
 if p.id is null then raise exception 'Profesional no disponible';end if;
 perform pg_advisory_xact_lock(hashtextextended('hc289-provider:'||p.username,0));
 select active,data_institution_id into instactive,dataid from public.hc_auth_institutions where id=p.institution_id;
 if not p.public_visible or not coalesce(instactive,false) or not exists(select 1 from public.hc_portal_institutions where institution_id=p.institution_id and enabled) then raise exception 'Agenda no publicada';end if;
 if not exists(select 1 from public.hc_portal_verifications where username=new.username and institution_id=p.institution_id and status='verified') then raise exception 'La identidad debe verificarse en esta institución antes de reservar';end if;
 if new.starts_at<now() or new.starts_at>now()+interval '180 days' then raise exception 'Fecha fuera del intervalo de reservas';end if;
 v_day=(new.starts_at at time zone 'America/Argentina/Buenos_Aires')::date;
 v_clock=(new.starts_at at time zone 'America/Argentina/Buenos_Aires')::time;
 v_end=(new.ends_at at time zone 'America/Argentina/Buenos_Aires')::time;
 daynum=extract(dow from v_day)::integer::text;
 if not p.private_practice then
 select payload->'value'->p.username into native from public.hc_state where institution_id=dataid and bucket='doctorSchedules' and not deleted limit 1;
 if native->'days' is not null and coalesce(native->>'updatedAt','')>coalesce(p.weekly->>'updatedAt','') then p.weekly=native;end if;
 end if;d=p.weekly->'days'->daynum;
 if d is null or not coalesce((d->>'active')::boolean,false) then raise exception 'Día no disponible';end if;
 span=coalesce((d->>'minutes')::integer,30);
 if span not in (10,15,20,30,40,60) or v_clock<(d->>'start')::time or v_end>(d->>'end')::time or
 (new.ends_at-new.starts_at)<>make_interval(mins=>span) or (new.ends_at at time zone 'America/Argentina/Buenos_Aires')::date<>v_day or
 mod(extract(epoch from(v_clock-(d->>'start')::time))::integer,span*60)<>0 then raise exception 'Horario fuera de la disponibilidad';end if;
 if new.telemedicine and not p.telemedicine then raise exception 'El profesional no ofrece telemedicina';end if;
 if exists(select 1 from public.hc_portal_bookings b join public.hc_portal_providers q on q.id=b.provider_id where q.username=p.username and b.id<>new.id and b.status in ('pending','confirmed') and b.starts_at<new.ends_at and b.ends_at>new.starts_at) then raise exception 'El horario acaba de ocuparse. Elegí otro';end if;
 if exists(select 1 from public.hc_portal_blocks b join public.hc_portal_providers q on q.id=b.provider_id where q.username=p.username and b.starts_at<new.ends_at and b.ends_at>new.starts_at) then raise exception 'El profesional bloqueó este horario';end if;
 -- Read only the legacy appointments of institutions where this professional works.
 for legacy in select s.payload->'value' from public.hc_state s where s.bucket='appointments' and not s.deleted and s.institution_id in
 (select i.data_institution_id from public.hc_auth_memberships m join public.hc_auth_institutions i on i.id=m.institution_id where m.username=p.username and m.active and i.active) loop
 if jsonb_typeof(legacy)<>'array' then continue;end if;
 for ap in select value from jsonb_array_elements(legacy) loop
  if coalesce(ap->>'doctorId','')<>p.username or coalesce(ap->>'status','') in ('cancelado','cancelled','anulado') or coalesce(ap->>'date','')<>v_day::text then continue;end if;
  begin
   old_start=((ap->>'date')||'T'||(ap->>'time'))::timestamp at time zone 'America/Argentina/Buenos_Aires';
   old_end=old_start+make_interval(mins=>greatest(1,least(240,coalesce(nullif(ap->>'durationMinutes','')::integer,nullif(ap->>'minutes','')::integer,30))));
   if old_start<new.ends_at and old_end>new.starts_at then raise exception using errcode='23P01',message='Horario ocupado en el turnero de la institución';end if;
  exception when invalid_text_representation or invalid_datetime_format then null;
  end;
 end loop;end loop;
 return new;
end$$;
create trigger hc289_booking_guard before insert or update on public.hc_portal_bookings for each row execute function public.hc289_booking_guard();

-- A new institutional appointment cannot overwrite an existing portal reservation.
create or replace function public.hc289_legacy_booking_guard() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare ap jsonb; who text; at_start timestamptz;at_end timestamptz;
begin
 if new.bucket<>'appointments' or new.deleted or jsonb_typeof(new.payload->'value')<>'array' then return new;end if;
 for who in select distinct value->>'doctorId' from jsonb_array_elements(new.payload->'value') where coalesce(value->>'doctorId','')<>'' order by 1 loop
 perform pg_advisory_xact_lock(hashtextextended('hc289-provider:'||who,0));end loop;
 for ap in select value from jsonb_array_elements(new.payload->'value') loop
 if coalesce(ap->>'status','') in ('cancelado','cancelled','anulado') then continue;end if;
 begin
 at_start=((ap->>'date')||'T'||(ap->>'time'))::timestamp at time zone 'America/Argentina/Buenos_Aires';
 at_end=at_start+make_interval(mins=>greatest(1,least(240,coalesce(nullif(ap->>'durationMinutes','')::integer,nullif(ap->>'minutes','')::integer,30))));
 if exists(select 1 from public.hc_portal_bookings b join public.hc_portal_providers p on p.id=b.provider_id where p.username=ap->>'doctorId' and b.status in ('pending','confirmed') and b.starts_at<at_end and b.ends_at>at_start) then raise exception 'Este horario tiene una reserva del portal. Revisá la agenda antes de guardar';end if;
 exception when invalid_text_representation or invalid_datetime_format then null;
 end;end loop;return new;
end$$;
create trigger hc289_legacy_booking_guard before insert or update on public.hc_state for each row when(new.bucket='appointments') execute function public.hc289_legacy_booking_guard();
create or replace function public.hc289_rate_hit(p_key text,p_limit integer,p_seconds integer) returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare count_now integer;
begin
 insert into public.hc_portal_rate_limits(key_hash) values(p_key)
 on conflict(key_hash)do update set hits=case when hc_portal_rate_limits.window_at<now()-make_interval(secs=>p_seconds) then 1 else hc_portal_rate_limits.hits+1 end,window_at=case when hc_portal_rate_limits.window_at<now()-make_interval(secs=>p_seconds) then now() else hc_portal_rate_limits.window_at end returning hits into count_now;
 return count_now<=p_limit;
end$$;
revoke all on function public.hc289_booking_guard(),public.hc289_legacy_booking_guard(),public.hc289_rate_hit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.hc289_booking_guard(),public.hc289_legacy_booking_guard(),public.hc289_rate_hit(text,integer,integer) to service_role;

create or replace function public.hc289_save_report(p_order uuid,p_revision integer,p_author text,p_text text,p_files jsonb,p_publish boolean)
returns public.hc_portal_orders language plpgsql security invoker set search_path=public,pg_temp as $$
declare r public.hc_portal_orders;
begin
 select * into r from public.hc_portal_orders where id=p_order for update;
 if r.id is null or r.revision<>p_revision then raise exception 'El informe cambió. Actualizá antes de guardar';end if;
 if r.status='cancelled' then raise exception 'Solicitud anulada';end if;
 if p_publish and r.status='published' then
 insert into public.hc_portal_report_versions(order_id,revision,report_text,report_files,status,author)values(r.id,r.revision,r.report_text,r.report_files,r.status,r.reported_by);
 end if;
 update public.hc_portal_orders set
 draft_text=case when p_publish then null else p_text end,draft_files=case when p_publish then '[]'::jsonb else p_files end,
 report_text=case when p_publish then p_text else report_text end,report_files=case when p_publish then p_files else report_files end,
 reported_by=case when p_publish then p_author else reported_by end,published_at=case when p_publish then now() else published_at end,
 status=case when p_publish or r.status='published' then 'published' else 'draft' end,revision=revision+1,updated_at=now()
 where id=p_order returning * into r;return r;
end$$;
revoke all on function public.hc289_save_report(uuid,integer,text,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.hc289_save_report(uuid,integer,text,text,jsonb,boolean) to service_role;

-- Manual closures serialize with reservations on the same professional.
create or replace function public.hc289_block_guard() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare who text;
begin
 select username into who from public.hc_portal_providers where id=new.provider_id;
 perform pg_advisory_xact_lock(hashtextextended('hc289-provider:'||who,0));
 if exists(select 1 from public.hc_portal_bookings b join public.hc_portal_providers p on p.id=b.provider_id where p.username=who and b.status in ('pending','confirmed') and b.starts_at<new.ends_at and b.ends_at>new.starts_at) then raise exception 'Hay una reserva en este horario. Revisala antes de bloquear';end if;
 return new;
end$$;
create trigger hc289_block_guard before insert or update on public.hc_portal_blocks for each row execute function public.hc289_block_guard();
revoke all on function public.hc289_block_guard() from public,anon,authenticated;
grant execute on function public.hc289_block_guard() to service_role;
