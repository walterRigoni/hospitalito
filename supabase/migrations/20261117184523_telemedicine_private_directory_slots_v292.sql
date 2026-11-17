alter table public.hc_tele_profiles add column if not exists id uuid not null default gen_random_uuid() unique;
create or replace function public.hc292_available_slots(who text,mode_name text,day_date date,duration integer) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare p hc_tele_profiles;d jsonb;n integer;last_min integer;st timestamptz;en timestamptz;free boolean;out jsonb='[]';
begin
select * into p from hc_tele_profiles where username=who and public_visible;
if p.username is null or mode_name not in('telemedicine','office') or not coalesce((p.modes->mode_name->>'enabled')::boolean,false) then raise exception 'Modalidad no publicada';end if;
if day_date<current_date-1 or day_date>current_date+90 or not exists(select 1 from jsonb_array_elements(p.modes->mode_name->'rates') r where (r->>'minutes')::integer=duration) then raise exception 'Fecha o duración no disponible';end if;
d=p.modes->mode_name->'weekly'->'days'->extract(dow from day_date)::integer::text;
if not coalesce((d->>'active')::boolean,false) then return out;end if;
n=extract(hour from(d->>'start')::time)::integer*60+extract(minute from(d->>'start')::time)::integer;last_min=extract(hour from(d->>'end')::time)::integer*60+extract(minute from(d->>'end')::time)::integer;
while n+duration<=last_min loop
st=(day_date::timestamp+make_interval(mins=>n)) at time zone 'America/Argentina/Buenos_Aires';en=st+make_interval(mins=>duration);n=n+15;if st<=now() then continue;end if;
free=true;begin perform hc292_assert_free(who,st,en);exception when others then free=false;end;
out=out||jsonb_build_array(jsonb_build_object('start',st,'local',to_char(st at time zone 'America/Argentina/Buenos_Aires','YYYY-MM-DD"T"HH24:MI'),'available',free));
end loop;return out;
end$$;
revoke all on function public.hc292_available_slots(text,text,date,integer) from public,anon,authenticated;
grant execute on function public.hc292_available_slots(text,text,date,integer) to service_role;