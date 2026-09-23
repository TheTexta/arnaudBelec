begin;

-- This Supabase instance also hosts Elliot's photographs. Keep Arnaud's
-- catalogue separate while retaining the same image and palette fields.
create table public.arnaud_photographs (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  filename text not null unique,
  image_width integer not null check (image_width > 0),
  image_height integer not null check (image_height > 0),
  captured_at date,
  title text,
  alt_text text,
  sort_order integer,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.arnaud_photo_palette_analyses (
  photograph_id uuid primary key references public.arnaud_photographs(id) on delete cascade,
  algorithm text not null,
  algorithm_iterations smallint not null check (algorithm_iterations > 0),
  sample_longest_side smallint not null check (sample_longest_side > 0),
  palette_size smallint not null check (palette_size > 0),
  analyzed_at timestamptz not null default timezone('utc', now())
);

create table public.arnaud_photo_palette_colours (
  photograph_id uuid not null references public.arnaud_photographs(id) on delete cascade,
  rank integer not null check (rank between 1 and 5),
  red smallint not null check (red between 0 and 255),
  green smallint not null check (green between 0 and 255),
  blue smallint not null check (blue between 0 and 255),
  hex text not null check (hex ~ '^#[0-9a-fA-F]{6}$'),
  lab_l real not null,
  lab_a real not null,
  lab_b real not null,
  weight real not null check (weight between 0 and 1),
  primary key (photograph_id, rank)
);

create index arnaud_photographs_public_order_idx
  on public.arnaud_photographs (sort_order asc nulls last, captured_at desc nulls last, filename desc);

create index arnaud_photo_palette_colours_lab_idx
  on public.arnaud_photo_palette_colours (lab_l, lab_a, lab_b);

revoke all on public.arnaud_photographs, public.arnaud_photo_palette_analyses,
  public.arnaud_photo_palette_colours from public, anon, authenticated;
grant select on public.arnaud_photographs, public.arnaud_photo_palette_colours
  to anon, authenticated;
grant all on public.arnaud_photographs, public.arnaud_photo_palette_analyses,
  public.arnaud_photo_palette_colours to service_role;

alter table public.arnaud_photographs enable row level security;
alter table public.arnaud_photo_palette_analyses enable row level security;
alter table public.arnaud_photo_palette_colours enable row level security;

create policy "read Arnaud photographs"
  on public.arnaud_photographs for select to anon, authenticated using (true);
create policy "read Arnaud palette colours"
  on public.arnaud_photo_palette_colours for select to anon, authenticated using (true);

-- The importer uploads the object first, then publishes all metadata in this
-- one transaction. Only the server-side service role can call this function.
create function public.arnaud_publish_photograph(
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
  if p_storage_path !~ '^uploads/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
    or p_filename is null or length(p_filename) > 240
    or p_algorithm is distinct from 'kmeans-rgb-v1'
    or p_algorithm_iterations is distinct from 10
    or p_sample_longest_side is distinct from 96
    or p_palette_size is distinct from 5
    or jsonb_typeof(p_colours) is distinct from 'array'
    or jsonb_array_length(p_colours) <> 5 then
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

revoke all on function public.arnaud_publish_photograph(
  uuid, text, text, integer, integer, date, text, text, integer,
  text, smallint, smallint, smallint, timestamptz, jsonb
) from public, anon, authenticated;
grant execute on function public.arnaud_publish_photograph(
  uuid, text, text, integer, integer, date, text, text, integer,
  text, smallint, smallint, smallint, timestamptz, jsonb
) to service_role;

notify pgrst, 'reload schema';
commit;
