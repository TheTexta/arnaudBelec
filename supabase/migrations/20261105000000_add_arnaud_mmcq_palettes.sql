begin;

-- Compatibility first: existing seven-colour writers remain valid. No stored
-- palettes, backgrounds, photographs, reservations or permissions are replaced.
create function public.arnaud_validate_photo_palette(
  p_algorithm text, p_algorithm_iterations smallint, p_sample_longest_side smallint,
  p_palette_size smallint, p_background_hex text, p_colours jsonb
) returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_new boolean := p_algorithm = 'mmcq64-vibrant-oklab-background-v1';
  v_count integer;
  v_ranks integer;
  v_hexes integer;
  v_weight double precision;
begin
  if p_algorithm is null or not (
    (p_algorithm = 'oklab-kmedoids-chroma-background-v2'
      and p_algorithm_iterations = 10 and p_sample_longest_side = 96 and p_palette_size = 7)
    or (v_new and p_algorithm_iterations = 2 and p_sample_longest_side in (96, 256)
      and p_palette_size between 1 and 7)
  ) or p_algorithm_iterations is null or p_sample_longest_side is null or p_palette_size is null
    or p_background_hex is null or p_background_hex !~ '^#[0-9a-fA-F]{6}$'
    or jsonb_typeof(p_colours) is distinct from 'array' then
    raise exception 'Invalid Arnaud palette analysis';
  end if;
  if jsonb_array_length(p_colours) <> p_palette_size then
    raise exception 'Invalid Arnaud palette count';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_colours) as c (
      rank integer, red smallint, green smallint, blue smallint, hex text,
      lab_l real, lab_a real, lab_b real, weight real
    ) where c.rank is null or c.rank not between 1 and p_palette_size
      or c.red is null or c.red not between 0 and 255
      or c.green is null or c.green not between 0 and 255
      or c.blue is null or c.blue not between 0 and 255
      or c.hex is null or lower(c.hex) <> '#' || lpad(to_hex(c.red::integer), 2, '0')
        || lpad(to_hex(c.green::integer), 2, '0') || lpad(to_hex(c.blue::integer), 2, '0')
      or c.lab_l is null or c.lab_l not between 0 and 100
      or c.lab_a is null or c.lab_a not between -200 and 200
      or c.lab_b is null or c.lab_b not between -200 and 200
      or c.weight is null or c.weight not between 0 and 1 or (v_new and c.weight = 0)
  ) then raise exception 'Invalid Arnaud palette colour'; end if;
  select count(*), count(distinct c.rank), count(distinct lower(c.hex)), sum(c.weight::double precision)
    into v_count, v_ranks, v_hexes, v_weight
    from jsonb_to_recordset(p_colours) as c (rank integer, hex text, weight real);
  if v_count <> p_palette_size or v_ranks <> p_palette_size
    or (v_new and v_hexes <> p_palette_size) or abs(v_weight - 1) > 0.000007 then
    raise exception 'Invalid Arnaud palette ranks or weights';
  end if;
end $$;
revoke all on function public.arnaud_validate_photo_palette(text, smallint, smallint, smallint, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.arnaud_validate_photo_palette(text, smallint, smallint, smallint, text, jsonb)
  to service_role;

-- Both Supabase publication and verified R2 publication call this implementation.
create or replace function public.arnaud_insert_photograph_metadata(p_metadata jsonb, p_provider text)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid := (p_metadata->>'p_photograph_id')::uuid;
  v_path text := p_metadata->>'p_storage_path';
begin
  perform public.arnaud_validate_photo_palette(
    p_metadata->>'p_algorithm', (p_metadata->>'p_algorithm_iterations')::smallint,
    (p_metadata->>'p_sample_longest_side')::smallint, (p_metadata->>'p_palette_size')::smallint,
    p_metadata->>'p_background_hex', p_metadata->'p_colours'
  );
  if p_provider is null or p_provider not in ('supabase', 'r2')
    or v_id is null or v_path is null
    or v_path !~ '^uploads/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
    or split_part(split_part(v_path, '/', 2), '.', 1) <> v_id::text
    or p_metadata->>'p_filename' is null or length(p_metadata->>'p_filename') not between 1 and 240
    or (p_metadata->>'p_image_width')::bigint is null
    or (p_metadata->>'p_image_height')::bigint is null
    or (p_metadata->>'p_image_width')::bigint < 1
    or (p_metadata->>'p_image_height')::bigint < 1
    or (p_metadata->>'p_image_width')::bigint * (p_metadata->>'p_image_height')::bigint > 120000000 then
    raise exception 'Invalid Arnaud photograph or palette';
  end if;
  if p_provider = 'supabase' and not exists (
    select 1 from storage.objects where bucket_id = 'arnaudbelec' and name = v_path
  ) then raise exception 'Arnaud image object does not exist'; end if;
  if p_provider = 'r2' and not exists (
    select 1 from public.arnaud_upload_reservations
    where id = v_id and storage_path = v_path and filename = p_metadata->>'p_filename'
      and state = 'verified' and sha256 is not null and published_etag is not null
  ) then raise exception 'Arnaud R2 upload has not been verified'; end if;

  insert into public.arnaud_photographs (
    id, storage_path, filename, image_width, image_height, captured_at,
    title, alt_text, sort_order, background_hex, storage_provider
  ) values (
    v_id, v_path, p_metadata->>'p_filename', (p_metadata->>'p_image_width')::integer,
    (p_metadata->>'p_image_height')::integer, (p_metadata->>'p_captured_at')::date,
    p_metadata->>'p_title', p_metadata->>'p_alt_text', (p_metadata->>'p_sort_order')::integer,
    p_metadata->>'p_background_hex', p_provider
  );
  insert into public.arnaud_photo_palette_analyses (
    photograph_id, algorithm, algorithm_iterations, sample_longest_side, palette_size, analyzed_at
  ) values (
    v_id, p_metadata->>'p_algorithm', (p_metadata->>'p_algorithm_iterations')::smallint,
    (p_metadata->>'p_sample_longest_side')::smallint, (p_metadata->>'p_palette_size')::smallint,
    (p_metadata->>'p_analyzed_at')::timestamptz
  );
  insert into public.arnaud_photo_palette_colours (
    photograph_id, rank, red, green, blue, hex, lab_l, lab_a, lab_b, weight
  ) select v_id, c.rank, c.red, c.green, c.blue, c.hex, c.lab_l, c.lab_a, c.lab_b, c.weight
    from jsonb_to_recordset(p_metadata->'p_colours') as c (
      rank integer, red smallint, green smallint, blue smallint, hex text, lab_l real, lab_a real, lab_b real, weight real
    );
end $$;

create or replace function public.arnaud_replace_photo_palette(
  p_photograph_id uuid, p_algorithm text, p_algorithm_iterations smallint,
  p_sample_longest_side smallint, p_palette_size smallint, p_analyzed_at timestamptz,
  p_background_hex text, p_colours jsonb
) returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform public.arnaud_validate_photo_palette(p_algorithm, p_algorithm_iterations,
    p_sample_longest_side, p_palette_size, p_background_hex, p_colours);
  -- Take the writer table lock BEFORE a photo row lock. Otherwise FOR UPDATE
  -- could slip past the batch's SHARE lock, then deadlock against its FK checks.
  lock table public.arnaud_photographs in row exclusive mode;
  perform 1 from public.arnaud_photographs where id = p_photograph_id for update;
  if not found then raise exception 'Arnaud photograph does not exist'; end if;
  -- A palette-only refresh must not touch the photograph's updated_at trigger.
  update public.arnaud_photographs set background_hex = p_background_hex
    where id = p_photograph_id and background_hex is distinct from p_background_hex;
  insert into public.arnaud_photo_palette_analyses (
    photograph_id, algorithm, algorithm_iterations, sample_longest_side, palette_size, analyzed_at
  ) values (
    p_photograph_id, p_algorithm, p_algorithm_iterations, p_sample_longest_side, p_palette_size, p_analyzed_at
  ) on conflict (photograph_id) do update set
    algorithm = excluded.algorithm, algorithm_iterations = excluded.algorithm_iterations,
    sample_longest_side = excluded.sample_longest_side, palette_size = excluded.palette_size,
    analyzed_at = excluded.analyzed_at;
  delete from public.arnaud_photo_palette_colours where photograph_id = p_photograph_id;
  insert into public.arnaud_photo_palette_colours (
    photograph_id, rank, red, green, blue, hex, lab_l, lab_a, lab_b, weight
  ) select p_photograph_id, c.rank, c.red, c.green, c.blue, c.hex, c.lab_l, c.lab_a, c.lab_b, c.weight
    from jsonb_to_recordset(p_colours) as c (
      rank integer, red smallint, green smallint, blue smallint, hex text, lab_l real, lab_a real, lab_b real, weight real
    );
end $$;

-- A service-only, read-only snapshot for the explicit operator workflow. Full
-- photograph rows guard text/order/provider/background edits, not only timestamps.
create function public.arnaud_palette_snapshot()
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_schema text;
begin
  if exists (
    select 1 from pg_class where oid in ('public.arnaud_photographs'::regclass,
      'public.arnaud_photo_palette_analyses'::regclass, 'public.arnaud_photo_palette_colours'::regclass)
      and relkind <> 'r'
  ) or exists (
    select 1 from pg_trigger where tgrelid in ('public.arnaud_photo_palette_analyses'::regclass,
      'public.arnaud_photo_palette_colours'::regclass) and not tgisinternal
  ) or exists (
    select 1 from pg_rewrite where ev_class in ('public.arnaud_photo_palette_analyses'::regclass,
      'public.arnaud_photo_palette_colours'::regclass)
  ) or exists (
    select 1 from pg_constraint where contype='f' and confrelid in ('public.arnaud_photo_palette_analyses'::regclass,
      'public.arnaud_photo_palette_colours'::regclass)
  ) or exists (
    select 1 from pg_attribute where attrelid in ('public.arnaud_photo_palette_analyses'::regclass,
      'public.arnaud_photo_palette_colours'::regclass) and attnum > 0 and not attisdropped
      and (attgenerated <> '' or attidentity <> '')
  ) then raise exception 'Unsupported Arnaud palette schema'; end if;
  select md5(jsonb_build_object(
    'tables', (select jsonb_agg(jsonb_build_object('name', c.relname, 'rls', c.relrowsecurity,
      'force_rls', c.relforcerowsecurity, 'acl', c.relacl, 'owner', c.relowner,
      'columns', (select jsonb_agg(jsonb_build_array(a.attname, format_type(a.atttypid,a.atttypmod), a.attnotnull)
        order by a.attnum) from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
      'constraints', (select jsonb_agg(pg_get_constraintdef(k.oid) order by k.conname) from pg_constraint k where k.conrelid=c.oid),
      'triggers', (select jsonb_agg(pg_get_triggerdef(t.oid) order by t.tgname) from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal),
      'rules', (select jsonb_agg(pg_get_ruledef(r.oid) order by r.rulename) from pg_rewrite r where r.ev_class=c.oid),
      'policies', (select jsonb_agg(to_jsonb(p) order by p.policyname) from pg_policies p where p.schemaname='public' and p.tablename=c.relname)
    ) order by c.relname) from pg_class c where c.oid in ('public.arnaud_photographs'::regclass,
      'public.arnaud_photo_palette_analyses'::regclass, 'public.arnaud_photo_palette_colours'::regclass)),
    'functions', (select jsonb_agg(jsonb_build_object('definition',pg_get_functiondef(p.oid),'acl',p.proacl,'owner',p.proowner)
      order by p.proname, p.oid) from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in (
        'arnaud_validate_photo_palette','arnaud_insert_photograph_metadata','arnaud_replace_photo_palette',
        'arnaud_publish_photograph','arnaud_publish_r2_photograph','arnaud_palette_snapshot','arnaud_apply_palette_snapshot'))
  )::text) into v_schema;
  return jsonb_build_object(
    'schema', v_schema,
    'photographs', coalesce((select jsonb_agg(to_jsonb(p) order by p.id) from public.arnaud_photographs p), '[]'::jsonb),
    'analyses', coalesce((select jsonb_agg(to_jsonb(a) order by a.photograph_id) from public.arnaud_photo_palette_analyses a), '[]'::jsonb),
    'colours', coalesce((select jsonb_agg(to_jsonb(c) order by c.photograph_id,c.rank) from public.arnaud_photo_palette_colours c), '[]'::jsonb)
  );
end $$;
revoke all on function public.arnaud_palette_snapshot() from public, anon, authenticated;
grant execute on function public.arnaud_palette_snapshot() to service_role;

-- One transaction replaces only Arnaud's two palette tables. The operator must
-- verify immutable original bytes BEFORE calling this; no storage IO holds locks.
-- Reversing the frozen snapshots provides the exact, guarded rollback operation.
create function public.arnaud_apply_palette_snapshot(p_expected jsonb, p_desired jsonb, p_verify boolean default false)
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
  delete from public.arnaud_photo_palette_colours;
  delete from public.arnaud_photo_palette_analyses;
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
