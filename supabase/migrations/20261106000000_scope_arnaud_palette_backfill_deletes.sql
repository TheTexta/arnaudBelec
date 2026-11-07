begin;

-- The production safe-update guard requires explicit WHERE clauses. Keep that
-- protection enabled: delete only palette rows belonging to the exact verified
-- frozen catalogue, under the same fixed-order locks and snapshot checks.
create or replace function public.arnaud_apply_palette_snapshot(p_expected jsonb, p_desired jsonb, p_verify boolean default false)
returns text language plpgsql security invoker set search_path = '' as $$
declare
  v_input jsonb;
  v_states jsonb[] := '{}';
  v_expected jsonb;
  v_desired jsonb;
  v_current jsonb;
  v_analysis record;
  v_background text;
  v_colours jsonb;
begin
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Arnaud palette apply requires READ COMMITTED';
  end if;
  if p_verify is null then raise exception 'Invalid Arnaud verification mode'; end if;
  perform set_config('lock_timeout','5s',true);
  perform set_config('statement_timeout','60s',true);
  for v_input in select unnest(array[p_expected,p_desired]) loop
    if jsonb_typeof(v_input->'photographs') is distinct from 'array'
      or jsonb_typeof(v_input->'analyses') is distinct from 'array'
      or jsonb_typeof(v_input->'colours') is distinct from 'array'
      or (v_input->>'schema') is null then raise exception 'Invalid Arnaud palette snapshot'; end if;
    -- Normalize through destination types: real precision and timestamptz JSON
    -- must compare exactly with a subsequent database snapshot.
    v_states := array_append(v_states, jsonb_build_object(
      'schema',v_input->>'schema',
      'photographs',coalesce((select jsonb_agg(to_jsonb(r) order by r.id)
        from jsonb_populate_recordset(null::public.arnaud_photographs,v_input->'photographs') r),'[]'::jsonb),
      'analyses',coalesce((select jsonb_agg(to_jsonb(r) order by r.photograph_id)
        from jsonb_populate_recordset(null::public.arnaud_photo_palette_analyses,v_input->'analyses') r),'[]'::jsonb),
      'colours',coalesce((select jsonb_agg(to_jsonb(r) order by r.photograph_id,r.rank)
        from jsonb_populate_recordset(null::public.arnaud_photo_palette_colours,v_input->'colours') r),'[]'::jsonb)
    ));
  end loop;
  v_expected := v_states[1]; v_desired := v_states[2];
  if v_expected->'photographs' is distinct from v_desired->'photographs'
    or v_expected->'schema' is distinct from v_desired->'schema' then
    raise exception 'Palette backfill cannot change photographs or schema';
  end if;
  if p_verify then
    v_current := public.arnaud_palette_snapshot();
    return case when v_current = v_desired then 'after' when v_current = v_expected then 'before' else 'stale' end;
  end if;
  lock table public.arnaud_photographs in share mode;
  lock table public.arnaud_photo_palette_analyses, public.arnaud_photo_palette_colours in share row exclusive mode;
  v_current := public.arnaud_palette_snapshot();
  if v_current = v_desired then return 'already_applied'; end if;
  if v_current <> v_expected then raise exception 'Stale Arnaud palette snapshot'; end if;
  for v_analysis in select * from jsonb_populate_recordset(null::public.arnaud_photo_palette_analyses,v_desired->'analyses') loop
    select p.background_hex into strict v_background from public.arnaud_photographs p where p.id=v_analysis.photograph_id;
    select coalesce(jsonb_agg(to_jsonb(c) order by c.rank),'[]'::jsonb) into v_colours
      from jsonb_populate_recordset(null::public.arnaud_photo_palette_colours,v_desired->'colours') c
      where c.photograph_id=v_analysis.photograph_id;
    perform public.arnaud_validate_photo_palette(v_analysis.algorithm,v_analysis.algorithm_iterations,
      v_analysis.sample_longest_side,v_analysis.palette_size,v_background,v_colours);
  end loop;
  if exists (
    select 1 from jsonb_populate_recordset(null::public.arnaud_photo_palette_colours,v_desired->'colours') c
    where not exists (select 1 from jsonb_populate_recordset(null::public.arnaud_photo_palette_analyses,v_desired->'analyses') a
      where a.photograph_id=c.photograph_id)
  ) then raise exception 'Arnaud palette colours require an analysis'; end if;
  delete from public.arnaud_photo_palette_colours
    where photograph_id in (select r.id from jsonb_populate_recordset(null::public.arnaud_photographs,v_expected->'photographs') r);
  delete from public.arnaud_photo_palette_analyses
    where photograph_id in (select r.id from jsonb_populate_recordset(null::public.arnaud_photographs,v_expected->'photographs') r);
  insert into public.arnaud_photo_palette_analyses
    select * from jsonb_populate_recordset(null::public.arnaud_photo_palette_analyses,v_desired->'analyses');
  insert into public.arnaud_photo_palette_colours
    select * from jsonb_populate_recordset(null::public.arnaud_photo_palette_colours,v_desired->'colours');
  if public.arnaud_palette_snapshot() <> v_desired then raise exception 'Arnaud palette verification failed'; end if;
  return 'applied';
end $$;
revoke all on function public.arnaud_apply_palette_snapshot(jsonb,jsonb,boolean) from public, anon, authenticated;
grant execute on function public.arnaud_apply_palette_snapshot(jsonb,jsonb,boolean) to service_role;

notify pgrst, 'reload schema';
commit;
