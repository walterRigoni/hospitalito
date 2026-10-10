-- History is append-preserving. Cache eviction and stale replicas cannot delete it.
create table if not exists public.hc_history_versions (
  id bigint generated always as identity primary key,
  institution_id text not null,
  record_id text not null,
  payload jsonb not null,
  payload_hash text not null,
  saved_at timestamptz not null default now(),
  writer text not null default '',
  unique (institution_id,record_id,payload_hash)
);
alter table public.hc_history_versions enable row level security;
revoke all on public.hc_history_versions from public,anon,authenticated;
grant select,insert on public.hc_history_versions to service_role;
grant usage,select on sequence public.hc_history_versions_id_seq to service_role;
create index if not exists hc_history_versions_lookup on public.hc_history_versions(institution_id,record_id,saved_at desc);

create or replace function public.hc280_merge_history(a jsonb,b jsonb)
returns jsonb language sql immutable set search_path=pg_catalog as $$
  with entries as (
    select e,ord from jsonb_array_elements(case when jsonb_typeof(a)='array' then a else '[]'::jsonb end) with ordinality x(e,ord)
    union all
    select e,ord+1000000 from jsonb_array_elements(case when jsonb_typeof(b)='array' then b else '[]'::jsonb end) with ordinality x(e,ord)
  ), chosen as (
    select distinct on (coalesce(nullif(e->>'id',''),nullif(e->>'recordId',''),md5(e::text))) e,ord
    from entries order by coalesce(nullif(e->>'id',''),nullif(e->>'recordId',''),md5(e::text)),
      coalesce(e->>'updatedAt',e->>'editedAt',e->>'reportedAt',e->>'createdAt','') desc,ord desc
  )
  select coalesce(jsonb_agg(e order by coalesce(e->>'createdAt',e->>'reportedAt',''),ord),'[]'::jsonb) from chosen;
$$;
revoke all on function public.hc280_merge_history(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.hc280_merge_history(jsonb,jsonb) to service_role;

create or replace function public.hc280_preserve_history()
returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v jsonb; merged jsonb;
begin
  if old.bucket='clinical' and old.record_id ~ '::(evolucionesFull|ingresosPrev|nursingReports|labResults|microResults)$' then
    v=old.payload->'value';
    if jsonb_array_length(case when jsonb_typeof(v)='array' then v else '[]'::jsonb end)>0 then
      if old.payload is distinct from new.payload or new.deleted then
        insert into public.hc_history_versions(institution_id,record_id,payload,payload_hash,writer)
          values(old.institution_id,old.record_id,old.payload,md5(old.payload::text),coalesce(old.writer,'')) on conflict do nothing;
      end if;
      if new.deleted then new.deleted=false; new.payload=old.payload;
      else
        merged=public.hc280_merge_history(v,new.payload->'value');
        new.payload=jsonb_set(coalesce(new.payload,'{}'::jsonb),'{value}',merged,true);
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.hc280_preserve_history() from public,anon,authenticated;
grant execute on function public.hc280_preserve_history() to service_role;
drop trigger if exists hc280_preserve_history on public.hc_state;
create trigger hc280_preserve_history before update of payload,deleted on public.hc_state for each row execute function public.hc280_preserve_history();
insert into public.hc_history_versions(institution_id,record_id,payload,payload_hash,writer)
 select institution_id,record_id,payload,md5(payload::text),coalesce(writer,'') from public.hc_state
 where bucket='clinical' and record_id ~ '::(evolucionesFull|ingresosPrev|nursingReports|labResults|microResults)$'
 and jsonb_array_length(case when jsonb_typeof(payload->'value')='array' then payload->'value' else '[]'::jsonb end)>0 on conflict do nothing;

create table if not exists public.hc_passkeys (
 id text primary key,username text not null references public.hc_auth_users(username) on delete cascade,
 public_key text not null,counter bigint not null default 0,transports jsonb not null default '[]',
 device_type text not null,backed_up boolean not null default false,label text not null default 'Mi dispositivo',
 created_at timestamptz not null default now(),revoked_at timestamptz
);
create index if not exists hc_passkeys_username on public.hc_passkeys(username);
create table if not exists public.hc_passkey_challenges (
 id uuid primary key default gen_random_uuid(),username text not null references public.hc_auth_users(username) on delete cascade,
 challenge text not null,kind text not null check(kind in ('registration','authentication')),
 token_hash text,origin text not null,expires_at timestamptz not null,created_at timestamptz not null default now()
);
create index if not exists hc_passkey_challenges_expiry on public.hc_passkey_challenges(expires_at);
alter table public.hc_passkeys enable row level security;
alter table public.hc_passkey_challenges enable row level security;
revoke all on public.hc_passkeys,public.hc_passkey_challenges from public,anon,authenticated;
grant select,insert,update,delete on public.hc_passkeys,public.hc_passkey_challenges to service_role;

create table if not exists public.hc_lab_inbox (
 id uuid primary key default gen_random_uuid(),institution_id text not null,patient_id text not null,request_id text not null,
 message_id text not null,source text not null,payload jsonb not null,status text not null default 'pending' check(status in ('pending','reviewed','rejected')),
 received_at timestamptz not null default now(),received_by text not null,reviewed_at timestamptz,reviewed_by text,
 unique(institution_id,source,message_id)
);
create index if not exists hc_lab_inbox_pending on public.hc_lab_inbox(institution_id,status,received_at);
alter table public.hc_lab_inbox enable row level security;
revoke all on public.hc_lab_inbox from public,anon,authenticated;
grant select,insert,update on public.hc_lab_inbox to service_role;
