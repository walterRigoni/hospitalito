create table public.hc_seed_devices (
  token_hash text primary key,
  institution_id text not null references public.hc_auth_institutions(id),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);
alter table public.hc_seed_devices enable row level security;
revoke all on public.hc_seed_devices from public, anon, authenticated;
grant select,insert,update,delete on public.hc_seed_devices to service_role;
comment on table public.hc_seed_devices is 'Revocable device credentials for one-time institutional binding. Plain tokens are never stored server-side.';
