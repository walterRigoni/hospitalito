create or replace function public.hc281_bulk_page(p_institution text,p_bucket text,p_offset integer default 0,p_limit integer default 5)
returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare r public.hc_state%rowtype; values_page jsonb; total integer;
begin
 if p_bucket not in ('pharmacyDrugs','archive','activity') then raise exception 'Catálogo no permitido'; end if;
 select * into r from public.hc_state where institution_id=p_institution and bucket=p_bucket and record_id='main';
 if not found or r.deleted then return jsonb_build_object('value','[]'::jsonb,'total',0,'revision',coalesce(r.revision,0),'deleted',true); end if;
 if jsonb_typeof(r.payload->'value')<>'array' then raise exception 'El catálogo debe ser una lista'; end if;
 total=jsonb_array_length(r.payload->'value');
 select coalesce(jsonb_agg(e order by ordinal),'[]'::jsonb) into values_page from jsonb_array_elements(r.payload->'value') with ordinality as x(e,ordinal) where ordinal>greatest(0,p_offset) and ordinal<=greatest(0,p_offset)+least(8,greatest(1,p_limit));
 return jsonb_build_object('value',values_page,'total',total,'revision',r.revision,'syncSeq',r.sync_seq,'deleted',false);
end;
$$;
revoke all on function public.hc281_bulk_page(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.hc281_bulk_page(text,text,integer,integer) to service_role;
