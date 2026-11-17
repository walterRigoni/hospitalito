alter table public.hc_tele_visits add column if not exists schedule_blocked boolean not null default false;
create or replace function public.hc292_tick(visit uuid,side_name text,is_connected boolean) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare v hc_tele_visits;entitled integer;elapsed numeric;at_now timestamptz=clock_timestamp();both_live boolean;schedule_blocked boolean=false;
begin
 select provider into v.provider from hc_tele_visits where id=visit;
 perform pg_advisory_xact_lock(hashtextextended('hc289-provider:'||v.provider,0));
 select * into v from hc_tele_visits where id=visit for update;if not found then raise exception 'Consulta no encontrada';end if;
 entitled=v.minutes*60+coalesce((select sum(minutes*60) from hc_tele_payments where visit_id=v.id and kind='extension' and status='approved' and applied),0);
 both_live=v.client_connected and v.provider_connected and v.client_seen>at_now-interval '12 seconds' and v.provider_seen>at_now-interval '12 seconds';
 if v.status='active' and both_live and v.consumed_seconds<entitled then begin perform hc292_assert_free(v.provider,at_now,at_now+make_interval(secs=>(entitled-v.consumed_seconds)::double precision),v.id);exception when others then schedule_blocked=true;end;end if;
 if v.status='active' and v.last_tick is not null and both_live and not schedule_blocked then v.consumed_seconds=least(entitled,v.consumed_seconds+greatest(0,least(8,extract(epoch from(at_now-v.last_tick)))));end if;
 if side_name='client' then v.client_seen=at_now;v.client_connected=is_connected;elsif side_name='provider' then v.provider_seen=at_now;v.provider_connected=is_connected;else raise exception 'Participante inválido';end if;
 both_live=v.client_connected and v.provider_connected and v.client_seen>at_now-interval '12 seconds' and v.provider_seen>at_now-interval '12 seconds';
 if v.mode='telemedicine' and v.status='confirmed' and both_live then
  if at_now<v.starts_at-interval '10 minutes' or at_now>v.ends_at then raise exception 'La consulta está fuera del horario reservado';end if;
  perform hc292_assert_free(v.provider,v.starts_at,at_now+make_interval(mins=>v.minutes),v.id);
  v.status='active';v.active_at=at_now;
 end if;
 if schedule_blocked then both_live=false;end if;
 update hc_tele_visits set schedule_blocked=schedule_blocked,status=v.status,active_at=v.active_at,consumed_seconds=v.consumed_seconds,last_tick=at_now,client_seen=v.client_seen,provider_seen=v.provider_seen,client_connected=v.client_connected,provider_connected=v.provider_connected where id=v.id;
 return jsonb_build_object('status',v.status,'remaining',greatest(0,entitled-v.consumed_seconds),'connected',both_live,'scheduleBlocked',schedule_blocked,'serverNow',at_now,'activeAt',v.active_at,'entitledSeconds',entitled);
end$$;

