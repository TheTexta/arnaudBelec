begin;

alter table public.arnaud_photographs
  add column storage_provider text not null default 'supabase'
    check (storage_provider in ('supabase', 'r2'));

-- Server-owned recovery journal. Auth user deletion must not delete media recovery
-- records, so user_id is deliberately not a cascading auth.users foreign key.
create table public.arnaud_upload_reservations (
  id uuid primary key,
  user_id uuid not null,
  filename text not null check (length(filename) between 1 and 240),
  storage_path text not null unique check (storage_path ~ '^uploads/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'),
  size_bytes bigint not null check (size_bytes between 1 and 524288000),
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  multipart_id text,
  state text not null default 'uploading' check (state in ('uploading', 'verified', 'published')),
  sha256 text check (sha256 ~ '^[a-f0-9]{64}$'),
  published_etag text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (state = 'uploading' or (sha256 is not null and published_etag is not null))
);
create index arnaud_upload_reservations_expiry_idx
  on public.arnaud_upload_reservations (expires_at) where state <> 'published';
alter table public.arnaud_upload_reservations enable row level security;
revoke all on public.arnaud_upload_reservations from public, anon, authenticated;
grant select, insert, update on public.arnaud_upload_reservations to service_role;

-- Shared insert implementation preserves the original transactional metadata and
-- palette semantics. Only the service role can invoke any publication function.
create function public.arnaud_insert_photograph_metadata(p_metadata jsonb, p_provider text)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid := (p_metadata->>'p_photograph_id')::uuid;
  v_path text := p_metadata->>'p_storage_path';
begin
  if p_provider is null or p_provider not in ('supabase', 'r2')
    or v_id is null or v_path is null
    or v_path !~ '^uploads/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
    or split_part(split_part(v_path, '/', 2), '.', 1) <> v_id::text
    or p_metadata->>'p_filename' is null or length(p_metadata->>'p_filename') not between 1 and 240
    or p_metadata->>'p_algorithm' is distinct from 'oklab-kmedoids-chroma-background-v2'
    or (p_metadata->>'p_algorithm_iterations')::integer is distinct from 10
    or (p_metadata->>'p_sample_longest_side')::integer is distinct from 96
    or (p_metadata->>'p_palette_size')::integer is distinct from 7
    or p_metadata->>'p_background_hex' is null
    or p_metadata->>'p_background_hex' !~ '^#[0-9a-fA-F]{6}$'
    or jsonb_typeof(p_metadata->'p_colours') is distinct from 'array'
    or jsonb_array_length(p_metadata->'p_colours') <> 7
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
  ) values (v_id, p_metadata->>'p_algorithm', 10, 96, 7, (p_metadata->>'p_analyzed_at')::timestamptz);
  insert into public.arnaud_photo_palette_colours (
    photograph_id, rank, red, green, blue, hex, lab_l, lab_a, lab_b, weight
  ) select v_id, c.rank, c.red, c.green, c.blue, c.hex, c.lab_l, c.lab_a, c.lab_b, c.weight
    from jsonb_to_recordset(p_metadata->'p_colours') as c (
      rank integer, red smallint, green smallint, blue smallint, hex text, lab_l real, lab_a real, lab_b real, weight real
    );
end $$;
revoke all on function public.arnaud_insert_photograph_metadata(jsonb, text) from public, anon, authenticated;
grant execute on function public.arnaud_insert_photograph_metadata(jsonb, text) to service_role;

create function public.arnaud_publish_r2_photograph(p_reservation_id uuid, p_metadata jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_reservation public.arnaud_upload_reservations%rowtype;
begin
  select * into strict v_reservation from public.arnaud_upload_reservations where id = p_reservation_id for update;
  if (p_metadata->>'p_photograph_id')::uuid is distinct from p_reservation_id
    or p_metadata->>'p_storage_path' is distinct from v_reservation.storage_path
    or p_metadata->>'p_filename' is distinct from v_reservation.filename then
    raise exception 'Upload reservation mismatch';
  end if;
  if v_reservation.state = 'published' then return; end if;
  if v_reservation.expires_at < now() or v_reservation.state <> 'verified' then
    raise exception 'Upload reservation is expired or unverified';
  end if;
  perform public.arnaud_insert_photograph_metadata(p_metadata, 'r2');
  update public.arnaud_upload_reservations set state = 'published' where id = p_reservation_id;
end $$;
revoke all on function public.arnaud_publish_r2_photograph(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.arnaud_publish_r2_photograph(uuid, jsonb) to service_role;

-- Keep the legacy signature and Storage existence check. This also corrects the
-- extra UUID group in the preceding migration's canonical-path expression.
create or replace function public.arnaud_publish_photograph(
  p_photograph_id uuid, p_storage_path text, p_filename text,
  p_image_width integer, p_image_height integer, p_captured_at date,
  p_title text, p_alt_text text, p_sort_order integer, p_algorithm text,
  p_algorithm_iterations smallint, p_sample_longest_side smallint,
  p_palette_size smallint, p_analyzed_at timestamptz, p_background_hex text, p_colours jsonb
) returns void language sql security invoker set search_path = '' as $$
  select public.arnaud_insert_photograph_metadata(jsonb_build_object(
    'p_photograph_id', p_photograph_id, 'p_storage_path', p_storage_path,
    'p_filename', p_filename, 'p_image_width', p_image_width, 'p_image_height', p_image_height,
    'p_captured_at', p_captured_at, 'p_title', p_title, 'p_alt_text', p_alt_text,
    'p_sort_order', p_sort_order, 'p_algorithm', p_algorithm,
    'p_algorithm_iterations', p_algorithm_iterations, 'p_sample_longest_side', p_sample_longest_side,
    'p_palette_size', p_palette_size, 'p_analyzed_at', p_analyzed_at,
    'p_background_hex', p_background_hex, 'p_colours', p_colours
  ), 'supabase');
$$;

notify pgrst, 'reload schema';
commit;
