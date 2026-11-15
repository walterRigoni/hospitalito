create or replace function public.hc289_booking_guard() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare p public.hc_portal_providers; v_day date; v_clock time; v_end time; d jsonb; span integer; daynum text;
 legacy jsonb; ap jsonb; old_start timestamptz; old_end timestamptz; dataid text; instactive boolean; native jsonb;
begin
 if new.status not in ('pending','confirmed') then return new; end if;
 select * into p from public.hc_portal_providers where id=new.provider_id;
 if p.id is null then raise exception 'Profesional no disponible';end if;
 perform pg_advisory_xact_lock(hashtextextended('hc289-provider:'||p.username,0));
 if not exists(select 1 from public.hc_auth_users u join public.hc_auth_memberships m on m.username=u.username where u.username=p.username and u.active and m.active and m.institution_id=p.institution_id and m.role in ('medico','enfermero','bioquimico','microbiologo','imagenologo','nutricionista','kinesiologo','hemoterapia')) then raise exception 'El profesional no tiene acceso activo a esta institución';end if;
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
 if native->'days' is not null and (case when coalesce(native->>'updatedAt','')='' then '1970-01-01Z'::timestamptz when native->>'updatedAt' ~ '(Z|[+-][0-9]{2}:[0-9]{2})$' then (native->>'updatedAt')::timestamptz else (native->>'updatedAt')::timestamp at time zone 'America/Argentina/Buenos_Aires' end)>coalesce(nullif(p.weekly->>'updatedAt','')::timestamptz,'1970-01-01Z'::timestamptz) then p.weekly=native;end if;
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

