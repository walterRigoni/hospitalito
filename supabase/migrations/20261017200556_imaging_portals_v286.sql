create table public.hc_imaging_portals (
 institution_id text primary key references public.hc_auth_institutions(id),
 payload jsonb not null default '{"portals":[],"activeId":""}'::jsonb,
 revision bigint not null default 1,
 updated_at timestamptz not null default now(),
 updated_by text not null
);
alter table public.hc_imaging_portals enable row level security;
revoke all on public.hc_imaging_portals from public,anon,authenticated;
grant select,insert,update on public.hc_imaging_portals to service_role;
comment on table public.hc_imaging_portals is 'Institution imaging portal configuration; custom authenticated backend access only, no patient data or credentials.';
