create table if not exists public.hc_service_records (
 institution_id text not null references public.hc_auth_institutions(id),
 kind text not null check (kind in ('donor','blood_unit','consent_template','consent_patient')),
 id uuid not null default gen_random_uuid(),
 patient_id text,
 payload jsonb not null default '{}'::jsonb,
 revision bigint not null default 1,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 updated_by text not null,
 primary key(institution_id,kind,id)
);
alter table public.hc_service_records enable row level security;
revoke all on public.hc_service_records from anon,authenticated;
grant select,insert,update,delete on public.hc_service_records to service_role;
create index if not exists hc_service_records_lookup on public.hc_service_records(institution_id,kind,patient_id,updated_at desc);
create unique index if not exists hc_blood_unit_code on public.hc_service_records(institution_id,(payload->>'code')) where kind='blood_unit';
create table if not exists public.hc_service_audit (
 id bigint generated always as identity primary key,
 institution_id text not null, kind text not null, record_id uuid not null,
 actor text not null, at timestamptz not null default now(),
 before_payload jsonb, after_payload jsonb not null
);
alter table public.hc_service_audit enable row level security;
revoke all on public.hc_service_audit from anon,authenticated;
grant select,insert on public.hc_service_audit to service_role;
grant usage,select on sequence public.hc_service_audit_id_seq to service_role;
create or replace function public.hc283_service_audit() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if TG_OP='UPDATE' then new.revision=old.revision+1; new.updated_at=clock_timestamp(); end if;
 insert into public.hc_service_audit(institution_id,kind,record_id,actor,before_payload,after_payload)
 values(new.institution_id,new.kind,new.id,new.updated_by,case when TG_OP='UPDATE' then old.payload else null end,new.payload);
 return new;
end $$;
revoke all on function public.hc283_service_audit() from public,anon,authenticated;
drop trigger if exists hc283_service_audit on public.hc_service_records;
create trigger hc283_service_audit before insert or update on public.hc_service_records for each row execute function public.hc283_service_audit();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('hc-consents','hc-consents',false,10485760,array['application/pdf','image/png','image/jpeg','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

