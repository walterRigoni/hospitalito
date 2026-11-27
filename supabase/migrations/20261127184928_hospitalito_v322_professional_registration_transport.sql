
alter table public.hc_auth_users add column if not exists login_alias text;
alter table public.hc_auth_users add column if not exists professional_registration jsonb;
alter table public.hc_auth_users add column if not exists transport_schedule jsonb;
create unique index if not exists hc322_login_alias_unique on public.hc_auth_users(lower(login_alias)) where login_alias is not null;
create or replace function public.hc322_check_alias() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if new.login_alias is not null and (new.login_alias !~ '^[a-z][a-z0-9_.-]{2,79}$' or lower(new.login_alias) in ('admin','hospitalito')) then raise exception 'Nombre de usuario inválido'; end if;
  if tg_op='INSERT' or new.username is distinct from old.username then
    perform pg_advisory_xact_lock(hashtext(lower(new.username)));
    if exists(select 1 from public.hc_auth_users where lower(login_alias)=lower(new.username)) then raise exception 'Nombre de usuario no disponible'; end if;
  end if;
  if new.login_alias is not null then
    perform pg_advisory_xact_lock(hashtext(lower(new.login_alias)));
    if exists(select 1 from public.hc_auth_users where lower(username)=lower(new.login_alias) and username<>new.username) then raise exception 'Nombre de usuario no disponible'; end if;
  end if;
  return new;
end $$;
revoke all on function public.hc322_check_alias() from public, anon, authenticated;
drop trigger if exists hc322_check_alias on public.hc_auth_users;
create trigger hc322_check_alias before insert or update of username,login_alias on public.hc_auth_users for each row execute function public.hc322_check_alias();
create table if not exists public.hc322_registration_attempts (key text not null, hour_bucket timestamptz not null, attempts int not null default 1, primary key(key,hour_bucket));
alter table public.hc322_registration_attempts enable row level security;
revoke all on public.hc322_registration_attempts from public, anon, authenticated;
grant select,insert,update,delete on public.hc322_registration_attempts to service_role;
create or replace function public.hc322_register_limit(p_key text) returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare n int;
begin
  delete from public.hc322_registration_attempts where hour_bucket<now()-interval '2 hours';
  insert into public.hc322_registration_attempts(key,hour_bucket) values(p_key,date_trunc('hour',now()))
  on conflict(key,hour_bucket) do update set attempts=hc322_registration_attempts.attempts+1 returning attempts into n;
  return n<=10;
end $$;
revoke all on function public.hc322_register_limit(text) from public,anon,authenticated;
grant execute on function public.hc322_register_limit(text) to service_role;
