begin;

-- Private working documents and immutable saved revisions. Identity is checked by
-- the existing server-only site allowlist, not a new shared admin mechanism.
create table public.arnaud_blog_posts (
  id uuid primary key,
  title text not null check (length(title) between 1 and 200),
  slug text not null unique check (length(slug) between 1 and 100 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  excerpt text not null default '' check (length(excerpt) <= 500),
  body jsonb not null check (jsonb_typeof(body) = 'array' and octet_length(body::text) <= 1048576),
  schema_version integer not null default 1 check (schema_version = 1),
  version integer not null default 1 check (version > 0),
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  first_published_at timestamptz
);
create table public.arnaud_blog_revisions (
  post_id uuid not null references public.arnaud_blog_posts(id),
  version integer not null,
  snapshot jsonb not null,
  saved_by uuid not null,
  saved_at timestamptz not null default now(),
  primary key (post_id, version)
);
create table public.arnaud_blog_publications (
  id uuid primary key references public.arnaud_blog_posts(id),
  title text not null,
  slug text not null unique,
  excerpt text not null,
  body jsonb not null,
  schema_version integer not null default 1,
  source_version integer not null,
  published_at timestamptz not null,
  updated_at timestamptz not null default now()
);
create index arnaud_blog_publications_date_idx on public.arnaud_blog_publications (published_at desc, id);

-- Objects are scoped to this site and a fixed blog prefix, never photo paths.
-- Keep both staging originals and publication recovery records; no automatic
-- cleanup or user-deletion cascade can remove an original.
create table public.arnaud_blog_media (
  id uuid primary key,
  post_id uuid not null references public.arnaud_blog_posts(id),
  storage_path text not null unique check (storage_path ~ '^blog/[0-9a-f-]{36}\.(jpg|png|webp|mp4|webm|mp3|ogg|wav)$' and split_part(split_part(storage_path, '/', 2), '.', 1) = id::text),
  filename text not null check (length(filename) between 1 and 240),
  content_type text not null check (content_type in ('image/jpeg','image/png','image/webp','video/mp4','video/webm','audio/mpeg','audio/ogg','audio/wav')),
  size_bytes bigint not null check (size_bytes between 1 and 104857600),
  multipart_id text,
  state text not null default 'uploading' check (state in ('uploading','ready','published')),
  sha256 text check (sha256 ~ '^[a-f0-9]{64}$'),
  source_etag text,
  published_etag text,
  created_at timestamptz not null default now(),
  check (state = 'uploading' or (sha256 is not null and source_etag is not null)),
  check (state <> 'published' or published_etag is not null)
);
create index arnaud_blog_media_post_idx on public.arnaud_blog_media (post_id);
create table public.arnaud_blog_publication_media (
  post_id uuid not null references public.arnaud_blog_publications(id) on delete cascade,
  media_id uuid not null references public.arnaud_blog_media(id),
  primary key (post_id, media_id)
);
create index arnaud_blog_publication_media_asset_idx on public.arnaud_blog_publication_media (media_id);

alter table public.arnaud_blog_posts enable row level security;
alter table public.arnaud_blog_revisions enable row level security;
alter table public.arnaud_blog_publications enable row level security;
alter table public.arnaud_blog_media enable row level security;
alter table public.arnaud_blog_publication_media enable row level security;
revoke all on public.arnaud_blog_posts, public.arnaud_blog_revisions, public.arnaud_blog_publications, public.arnaud_blog_media, public.arnaud_blog_publication_media from public, anon, authenticated;
grant select, insert, update on public.arnaud_blog_posts, public.arnaud_blog_revisions, public.arnaud_blog_media to service_role;
grant select, insert, update, delete on public.arnaud_blog_publications, public.arnaud_blog_publication_media to service_role;
grant select on public.arnaud_blog_publications, public.arnaud_blog_publication_media to anon, authenticated;
grant select (id, storage_path, content_type, state) on public.arnaud_blog_media to anon, authenticated;
create policy arnaud_blog_published_read on public.arnaud_blog_publications for select to anon, authenticated using (true);
create policy arnaud_blog_published_media_read on public.arnaud_blog_publication_media for select to anon, authenticated using (true);
create policy arnaud_blog_media_read on public.arnaud_blog_media for select to anon, authenticated using (
  state = 'published' and exists (select 1 from public.arnaud_blog_publication_media pm where pm.media_id = arnaud_blog_media.id)
);

create function public.arnaud_save_blog_post(p_id uuid, p_version integer, p_document jsonb, p_user_id uuid)
returns public.arnaud_blog_posts language plpgsql security invoker set search_path = '' as $$
declare v_post public.arnaud_blog_posts%rowtype;
begin
  select * into v_post from public.arnaud_blog_posts where id = p_id for update;
  if found then
    if v_post.version <> p_version then raise exception 'blog_conflict' using errcode = '40001'; end if;
    if v_post.first_published_at is not null and v_post.slug <> p_document->>'slug' then
      raise exception 'Published post URLs cannot be changed';
    end if;
    update public.arnaud_blog_posts set title = p_document->>'title', slug = p_document->>'slug',
      excerpt = p_document->>'excerpt', body = p_document->'body', version = version + 1,
      updated_by = p_user_id, updated_at = now() where id = p_id returning * into v_post;
  else
    if p_version <> 0 then raise exception 'blog_conflict' using errcode = '40001'; end if;
    insert into public.arnaud_blog_posts (id,title,slug,excerpt,body,updated_by)
      values (p_id,p_document->>'title',p_document->>'slug',p_document->>'excerpt',p_document->'body',p_user_id)
      returning * into v_post;
  end if;
  insert into public.arnaud_blog_revisions (post_id,version,snapshot,saved_by)
    values (p_id,v_post.version,jsonb_build_object('title',v_post.title,'slug',v_post.slug,'excerpt',v_post.excerpt,'body',v_post.body),p_user_id);
  return v_post;
end $$;

create function public.arnaud_publish_blog_post(p_id uuid, p_version integer, p_media_ids uuid[])
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_post public.arnaud_blog_posts%rowtype;
  v_media_ids uuid[];
begin
  select * into strict v_post from public.arnaud_blog_posts where id = p_id for update;
  if v_post.version <> p_version then raise exception 'blog_conflict' using errcode = '40001'; end if;
  select coalesce(array_agg(distinct substring(url #>> '{}' from '^/blog/media/([0-9a-f-]{36})$')::uuid)
    filter (where url #>> '{}' ~ '^/blog/media/[0-9a-f-]{36}$'), '{}'::uuid[])
    into v_media_ids from jsonb_path_query(v_post.body, '$.**.props.url') urls(url);
  if (v_media_ids @> p_media_ids and p_media_ids @> v_media_ids) is not true then
    raise exception 'Blog media references do not match the saved document';
  end if;
  if exists (select 1 from unnest(p_media_ids) i left join public.arnaud_blog_media m
    on m.id = i and m.post_id = p_id and m.state = 'published' where m.id is null) then
    raise exception 'Blog media is not verified or belongs to another post';
  end if;
  update public.arnaud_blog_posts set first_published_at = coalesce(first_published_at,now()) where id = p_id;
  insert into public.arnaud_blog_publications (id,title,slug,excerpt,body,source_version,published_at)
    values (p_id,v_post.title,v_post.slug,v_post.excerpt,v_post.body,v_post.version,coalesce(v_post.first_published_at,now()))
    on conflict (id) do update set title = excluded.title, slug = excluded.slug, excerpt = excluded.excerpt,
      body = excluded.body, source_version = excluded.source_version, updated_at = now();
  delete from public.arnaud_blog_publication_media where post_id = p_id;
  insert into public.arnaud_blog_publication_media (post_id,media_id) select p_id, i from (select distinct unnest(p_media_ids) i) ids;
end $$;

create function public.arnaud_unpublish_blog_post(p_id uuid, p_version integer)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_version integer;
begin
  select version into strict v_version from public.arnaud_blog_posts where id = p_id for update;
  if v_version <> p_version then raise exception 'blog_conflict' using errcode = '40001'; end if;
  delete from public.arnaud_blog_publications where id = p_id;
end $$;
revoke all on function public.arnaud_save_blog_post(uuid,integer,jsonb,uuid), public.arnaud_publish_blog_post(uuid,integer,uuid[]), public.arnaud_unpublish_blog_post(uuid,integer) from public, anon, authenticated;
grant execute on function public.arnaud_save_blog_post(uuid,integer,jsonb,uuid), public.arnaud_publish_blog_post(uuid,integer,uuid[]), public.arnaud_unpublish_blog_post(uuid,integer) to service_role;
notify pgrst, 'reload schema';
commit;
