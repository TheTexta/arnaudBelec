begin;

-- Keep both privileged write paths on the same seven-colour extractor.
create or replace function public.arnaud_publish_photograph(
  p_photograph_id uuid,
  p_storage_path text,
  p_filename text,
  p_image_width integer,
  p_image_height integer,
  p_captured_at date,
  p_title text,
  p_alt_text text,
  p_sort_order integer,
  p_algorithm text,
  p_algorithm_iterations smallint,
  p_sample_longest_side smallint,
  p_palette_size smallint,
  p_analyzed_at timestamptz,
  p_colours jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_storage_path !~ '^uploads/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
    or p_filename is null or length(p_filename) > 240
    or p_algorithm is distinct from 'oklab-kmedoids-chroma-v1'
    or p_algorithm_iterations is distinct from 10
    or p_sample_longest_side is distinct from 96
    or p_palette_size is distinct from 7
    or jsonb_typeof(p_colours) is distinct from 'array'
    or jsonb_array_length(p_colours) <> 7 then
    raise exception 'Invalid Arnaud photograph or palette';
  end if;

  if not exists (
    select 1 from storage.objects
    where bucket_id = 'arnaudbelec' and name = p_storage_path
  ) then
    raise exception 'Arnaud image object does not exist';
  end if;

  insert into public.arnaud_photographs (
    id, storage_path, filename, image_width, image_height,
    captured_at, title, alt_text, sort_order
  ) values (
    p_photograph_id, p_storage_path, p_filename, p_image_width, p_image_height,
    p_captured_at, p_title, p_alt_text, p_sort_order
  );

  insert into public.arnaud_photo_palette_analyses (
    photograph_id, algorithm, algorithm_iterations,
    sample_longest_side, palette_size, analyzed_at
  ) values (
    p_photograph_id, p_algorithm, p_algorithm_iterations,
    p_sample_longest_side, p_palette_size, p_analyzed_at
  );

  insert into public.arnaud_photo_palette_colours (
    photograph_id, rank, red, green, blue, hex,
    lab_l, lab_a, lab_b, weight
  )
  select
    p_photograph_id, colour.rank, colour.red, colour.green, colour.blue,
    colour.hex, colour.lab_l, colour.lab_a, colour.lab_b, colour.weight
  from jsonb_to_recordset(p_colours) as colour (
    rank integer, red smallint, green smallint, blue smallint, hex text,
    lab_l real, lab_a real, lab_b real, weight real
  );
end
$$;

create or replace function public.arnaud_replace_photo_palette(
  p_photograph_id uuid,
  p_algorithm text,
  p_algorithm_iterations smallint,
  p_sample_longest_side smallint,
  p_palette_size smallint,
  p_analyzed_at timestamptz,
  p_colours jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_algorithm is distinct from 'oklab-kmedoids-chroma-v1'
    or p_algorithm_iterations is distinct from 10
    or p_sample_longest_side is distinct from 96
    or p_palette_size is distinct from 7
    or jsonb_typeof(p_colours) is distinct from 'array'
    or jsonb_array_length(p_colours) <> 7 then
    raise exception 'Invalid Arnaud palette analysis';
  end if;

  if not exists (
    select 1 from public.arnaud_photographs where id = p_photograph_id
  ) then
    raise exception 'Arnaud photograph does not exist';
  end if;

  insert into public.arnaud_photo_palette_analyses (
    photograph_id, algorithm, algorithm_iterations,
    sample_longest_side, palette_size, analyzed_at
  ) values (
    p_photograph_id, p_algorithm, p_algorithm_iterations,
    p_sample_longest_side, p_palette_size, p_analyzed_at
  ) on conflict (photograph_id) do update set
    algorithm = excluded.algorithm,
    algorithm_iterations = excluded.algorithm_iterations,
    sample_longest_side = excluded.sample_longest_side,
    palette_size = excluded.palette_size,
    analyzed_at = excluded.analyzed_at;

  delete from public.arnaud_photo_palette_colours
  where photograph_id = p_photograph_id;

  insert into public.arnaud_photo_palette_colours (
    photograph_id, rank, red, green, blue, hex,
    lab_l, lab_a, lab_b, weight
  )
  select
    p_photograph_id, colour.rank, colour.red, colour.green, colour.blue,
    colour.hex, colour.lab_l, colour.lab_a, colour.lab_b, colour.weight
  from jsonb_to_recordset(p_colours) as colour (
    rank integer, red smallint, green smallint, blue smallint, hex text,
    lab_l real, lab_a real, lab_b real, weight real
  );
end
$$;

notify pgrst, 'reload schema';
commit;
