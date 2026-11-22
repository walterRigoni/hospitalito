create table public.hc_appointment_waitlist (
  id uuid primary key default gen_random_uuid(),
  username text not null references public.hc_portal_clients(username) on delete cascade,
  mode text not null check (mode in ('institution','telemedicine','office','home')),
  role text not null check (role in ('medico','enfermero','bioquimico','microbiologo','imagenologo','nutricionista','kinesiologo','hemoterapia')),
  specialty text not null default '' check (length(specialty)<=150),
  from_day date not null,
  until_day date not null check (until_day=from_day+14),
  created_at timestamptz not null default now(),
  unique(username,mode,role,specialty,from_day)
);
alter table public.hc_appointment_waitlist enable row level security;
revoke all on table public.hc_appointment_waitlist from public, anon, authenticated;
grant select, insert, update, delete on table public.hc_appointment_waitlist to service_role;
create index hc317_waitlist_match on public.hc_appointment_waitlist(mode,role,from_day,until_day);

create function public.hc317_join_waitlist(patient text, care_mode text, care_role text, care_specialty text, first_day date)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare today date:=(now() at time zone 'America/Argentina/Buenos_Aires')::date; saved hc_appointment_waitlist;
begin
  if first_day is null or first_day<today or first_day>today+90 then
    raise exception 'La fecha de la lista de espera está fuera del calendario';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('hc317-waitlist:'||patient,0));
  delete from hc_appointment_waitlist where username=patient and until_day<today;
  select * into saved from hc_appointment_waitlist where username=patient and mode=care_mode and role=care_role and specialty=care_specialty and from_day=first_day;
  if found then return to_jsonb(saved); end if;
  if (select count(*) from hc_appointment_waitlist where username=patient)>=12 then
    raise exception 'Ya tenés 12 búsquedas activas. Podés quitar alguna desde Mis Turnos';
  end if;
  insert into hc_appointment_waitlist(username,mode,role,specialty,from_day,until_day)
    values(patient,care_mode,care_role,care_specialty,first_day,first_day+14)
    returning * into saved;
  return to_jsonb(saved);
end $$;

create function public.hc317_change_institution_booking(patient text, booking uuid, previous_start timestamptz, new_start timestamptz)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare b hc_portal_bookings; p hc_portal_providers; i hc_auth_institutions; native jsonb; d jsonb; span integer;
begin
  select * into b from hc_portal_bookings where id=booking and username=patient for update;
  if not found then raise exception 'Turno no autorizado'; end if;
  if (new_start is null and b.status='cancelled') or (new_start=b.starts_at and b.status in ('pending','confirmed')) then return to_jsonb(b); end if;
  if b.starts_at is distinct from previous_start then raise exception 'El turno cambió. Actualizá Mis Turnos'; end if;
  if b.status not in ('pending','confirmed') or b.starts_at<=now() then raise exception 'El turno ya comenzó o finalizó'; end if;
  if new_start is null then
    update hc_portal_bookings set status='cancelled',updated_at=now() where id=b.id returning * into b;
    return to_jsonb(b);
  end if;
  select * into p from hc_portal_providers where id=b.provider_id;
  perform pg_advisory_xact_lock(hashtextextended('hc289-provider:'||p.username,0));
  select * into i from hc_auth_institutions where id=p.institution_id;
  if not p.private_practice then
    select payload->'value'->p.username into native from hc_state where institution_id=i.data_institution_id and bucket='doctorSchedules' and not deleted limit 1;
    if native->'days' is not null and
      (case when coalesce(native->>'updatedAt','')='' then '1970-01-01Z'::timestamptz
        when native->>'updatedAt' ~ '(Z|[+-][0-9]{2}:[0-9]{2})$' then (native->>'updatedAt')::timestamptz
        else (native->>'updatedAt')::timestamp at time zone 'America/Argentina/Buenos_Aires' end)
      > coalesce(nullif(p.weekly->>'updatedAt','')::timestamptz,'1970-01-01Z'::timestamptz) then p.weekly=native; end if;
  end if;
  d=p.weekly->'days'->extract(dow from new_start at time zone 'America/Argentina/Buenos_Aires')::integer::text;
  span=coalesce((d->>'minutes')::int,30);
  -- Existing triggers verify the schedule, identity and conflicts.
  update hc_portal_bookings set starts_at=new_start,ends_at=new_start+make_interval(mins=>span),updated_at=now() where id=b.id returning * into b;
  return to_jsonb(b);
end $$;

create function public.hc317_change_private_visit(account text, visit uuid, previous_start timestamptz, new_start timestamptz)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare v hc_tele_visits; p hc_tele_profiles; window_info jsonb; day_info jsonb; at_end timestamptz; local_start timestamp; local_end timestamp; paid boolean;
begin
  select provider into v.provider from hc_tele_visits where id=visit and account in (client,provider);
  if not found then raise exception 'Turno no autorizado'; end if;
  perform pg_advisory_xact_lock(hashtextextended('hc289-provider:'||v.provider,0));
  select * into v from hc_tele_visits where id=visit and account in (client,provider) for update;
  if not found then raise exception 'Turno no autorizado'; end if;
  if new_start is not null and account<>v.client then raise exception 'Reprogramación no autorizada'; end if;
  if not ((new_start is null and v.status='cancelled') or (new_start is not null and new_start=v.starts_at and v.status in ('confirmed','awaiting_payment'))) then
    if v.starts_at is distinct from previous_start then raise exception 'El turno cambió. Actualizá Mis Turnos'; end if;
    if v.status not in ('confirmed','awaiting_payment') or v.active_at is not null
      or (account=v.client and (v.starts_at<=now() or v.status='awaiting_payment' and v.hold_until<=now())) then
      raise exception 'El turno ya comenzó, venció o finalizó';
    end if;
    if new_start is null then
      update hc_tele_visits set status='cancelled',finished_at=now() where id=v.id returning * into v;
    else
      select * into p from hc_tele_profiles where username=v.provider and public_visible;
      if not found or v.schedule_blocked or not coalesce((p.modes->v.mode->>'enabled')::boolean,false)
        or not exists(select 1 from hc_auth_users u where u.username=p.username and u.active and
          (u.default_role=p.role or exists(select 1 from hc_auth_memberships m join hc_auth_institutions i on i.id=m.institution_id and i.active where m.username=u.username and m.role=p.role and m.active))) then
        raise exception 'La agenda del profesional no está publicada';
      end if;
      at_end=new_start+make_interval(mins=>v.minutes);
      local_start=new_start at time zone 'America/Argentina/Buenos_Aires';
      local_end=at_end at time zone 'America/Argentina/Buenos_Aires';
      day_info=p.modes->v.mode->'weekly'->'days'->extract(dow from local_start)::integer::text;
      select value into window_info
        from jsonb_array_elements(coalesce(day_info->'windows',jsonb_build_array(jsonb_build_object('start',day_info->>'start','end',day_info->>'end','address',p.address))))
        where local_start::time>=(value->>'start')::time and local_end::time<=(value->>'end')::time
          and mod(extract(epoch from(local_start::time-(value->>'start')::time)),900)=0 limit 1;
      if new_start<=now() or new_start>now()+interval '90 days' or local_end::date<>local_start::date
        or not coalesce((day_info->>'active')::boolean,false) or window_info is null then
        raise exception 'Horario fuera de la disponibilidad publicada';
      end if;
      perform hc292_assert_free(v.provider,new_start,at_end,v.id);
      update hc_tele_visits set starts_at=new_start,ends_at=at_end,
        location_snapshot=case when mode='office' then concat_ws(' · ',nullif(window_info->>'location',''),nullif(coalesce(window_info->>'address',p.address),'')) else location_snapshot end
        where id=v.id returning * into v;
    end if;
  end if;
  if new_start is null then
    insert into hc_tele_refund_requests(payment_id,requested_by,reason)
      select id,account,case when account=v.provider then 'Cancelación del profesional' else 'Cancelación del paciente; revisar condiciones aceptadas' end
      from hc_tele_payments where visit_id=v.id and status='approved' on conflict(payment_id) do nothing;
  end if;
  paid=exists(select 1 from hc_tele_payments where visit_id=v.id and status='approved');
  return jsonb_build_object('id',v.id,'starts_at',v.starts_at,'ends_at',v.ends_at,'status',v.status,'refundPending',new_start is null and paid);
end $$;

create function public.hc317_appointment_event() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $$
declare mode_name text; customer text; clinician text; clinician_id uuid; care_role text; care_specialty text;
  subject jsonb; message_title text; message_body text; old_day date; old_local text; change_id uuid:=gen_random_uuid(); released boolean:=true;
begin
  if tg_table_name='hc_portal_bookings' then
    if old.status not in ('confirmed','pending') then return new; end if;
    customer=old.username; mode_name='institution';
    select p.username,p.id,m.role,p.specialty into clinician,clinician_id,care_role,care_specialty
    from hc_portal_providers p left join hc_auth_memberships m on m.username=p.username and m.institution_id=p.institution_id and m.active where p.id=old.provider_id;
    subject=jsonb_build_object('bookingId',new.id,'mode',mode_name);
  else
    if old.status not in ('confirmed','awaiting_payment') then return new; end if;
    customer=old.client; clinician=old.provider; mode_name=old.mode;
    select p.id,p.role,p.specialty into clinician_id,care_role,care_specialty from hc_tele_profiles p where p.username=clinician;
    subject=jsonb_build_object('visitId',new.id,'mode',mode_name);
  end if;
  if new.status='cancelled' and old.status<>new.status then
    message_title='Turno cancelado';
    message_body='Se canceló el turno del '||to_char(old.starts_at at time zone 'America/Argentina/Buenos_Aires','DD/MM/YYYY HH24:MI')||'.';
  elsif new.starts_at<>old.starts_at then
    message_title='Turno reprogramado';
    message_body='El turno pasó del '||to_char(old.starts_at at time zone 'America/Argentina/Buenos_Aires','DD/MM/YYYY HH24:MI')||
      ' al '||to_char(new.starts_at at time zone 'America/Argentina/Buenos_Aires','DD/MM/YYYY HH24:MI')||'.';
  else return new; end if;
  insert into hc_notifications(username,kind,title,body,payload)
    select distinct recipient,'appointment_change',message_title,message_body,subject
    from unnest(array[customer,clinician]) as recipients(recipient) where recipient is not null;
  if old.starts_at<=now() or care_role is null then return new; end if;
  old_day=(old.starts_at at time zone 'America/Argentina/Buenos_Aires')::date;
  old_local=to_char(old.starts_at at time zone 'America/Argentina/Buenos_Aires','YYYY-MM-DD"T"HH24:MI');
  if not exists(select 1 from hc_appointment_waitlist w where w.mode=mode_name and w.role=care_role
    and (w.specialty='' or lower(w.specialty)=lower(care_specialty)) and old_day between w.from_day and w.until_day and w.username<>customer) then return new; end if;
  begin perform hc292_assert_free(clinician,old.starts_at,old.ends_at);
  exception when raise_exception or exclusion_violation then released=false; end;
  if not released then return new; end if;
  if mode_name<>'institution' then
    begin
      if not exists(select 1 from jsonb_array_elements(hc297_available_slots(clinician,mode_name,old_day,old.minutes)) s
        where (s->>'available')::boolean and (s->>'start')::timestamptz=old.starts_at) then return new; end if;
    exception when raise_exception then return new; end;
  end if;
  insert into hc_notifications(id,username,kind,title,body,payload)
    select distinct md5(change_id::text||w.username)::uuid,w.username,'appointment_waitlist','Se liberó un turno',
      coalesce(nullif(care_specialty,''),'Turno disponible')||' · '||to_char(old.starts_at at time zone 'America/Argentina/Buenos_Aires','DD/MM/YYYY HH24:MI')||'. Consultá si sigue disponible.',
      jsonb_build_object('providerId',clinician_id,'mode',mode_name,'role',care_role,'specialty',care_specialty,'local',old_local,
        'minutes',(extract(epoch from(old.ends_at-old.starts_at))/60)::integer)
    from hc_appointment_waitlist w join hc_auth_users u on u.username=w.username and u.active
    where w.mode=mode_name and w.role=care_role and (w.specialty='' or lower(w.specialty)=lower(care_specialty))
      and old_day between w.from_day and w.until_day and w.username<>customer
      and (mode_name<>'institution' or exists(select 1 from hc_portal_providers p join hc_portal_institutions i on i.institution_id=p.institution_id and i.enabled
        join hc_auth_institutions h on h.id=i.institution_id and h.active
        join hc_portal_verifications a on a.institution_id=i.institution_id and a.username=w.username and a.status='verified'
        where p.id=clinician_id and p.public_visible));
  return new;
end $$;
create trigger hc317_institution_event after update of starts_at,status on public.hc_portal_bookings for each row execute function public.hc317_appointment_event();
create trigger hc317_private_event after update of starts_at,status on public.hc_tele_visits for each row execute function public.hc317_appointment_event();

create function public.hc317_next_private_slots(who text, care_mode text, first_day date, last_day date, duration integer)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare today date:=(now() at time zone 'America/Argentina/Buenos_Aires')::date; search_day date; result jsonb:='[]';
begin
  if first_day<today or first_day>today+90 or last_day<first_day or last_day>least(first_day+13,today+90) then return result; end if;
  for search_day in select first_day+n from generate_series(0,last_day-first_day) as days(n) loop
    select result||coalesce(jsonb_agg(s.slot),'[]') into result from (
      select slot from jsonb_array_elements(hc297_available_slots(who,care_mode,search_day,duration)) as x(slot)
        where (slot->>'available')::boolean order by slot->>'start' limit (2-jsonb_array_length(result))
    ) s;
    if jsonb_array_length(result)>=2 then exit; end if;
  end loop;
  return result;
end $$;

create function public.hc317_private_busy(who text, first_at timestamptz, last_at timestamptz)
returns table(start_at timestamptz,end_at timestamptz) language sql stable security invoker set search_path=public,pg_temp as $$
  select v.starts_at,hc292_reserved_end(v) from hc_tele_visits v
  where v.provider=who and v.starts_at<last_at and hc292_reserved_end(v)>first_at
    and (v.status in ('confirmed','active') or v.status='awaiting_payment' and v.hold_until>now());
$$;

revoke all on function public.hc317_join_waitlist(text,text,text,text,date),
  public.hc317_change_institution_booking(text,uuid,timestamptz,timestamptz),public.hc317_change_private_visit(text,uuid,timestamptz,timestamptz),
  public.hc317_appointment_event(),public.hc317_next_private_slots(text,text,date,date,int),public.hc317_private_busy(text,timestamptz,timestamptz)
  from public,anon,authenticated;
grant execute on function public.hc317_join_waitlist(text,text,text,text,date),
  public.hc317_change_institution_booking(text,uuid,timestamptz,timestamptz),public.hc317_change_private_visit(text,uuid,timestamptz,timestamptz),
  public.hc317_appointment_event(),public.hc317_next_private_slots(text,text,date,date,int),public.hc317_private_busy(text,timestamptz,timestamptz)
  to service_role;
