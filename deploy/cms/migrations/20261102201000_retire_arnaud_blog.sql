-- OPERATOR ONLY: freeze writers, run approved reset, then native-journal migration.
-- Separate from ordinary Supabase bootstrap migrations: requires Payload schema.
-- This is not a content deletion command. No CASCADE or shared-object changes.
begin;
do $$
begin
  if to_regclass('arnaud_cms.media') is null or not exists (
    select 1 from information_schema.columns
    where table_schema = 'arnaud_cms' and table_name = 'posts' and column_name = 'edit_revision'
  ) then
    raise exception 'Native journal migration must run before legacy retirement';
  end if;
end $$;
lock table public.arnaud_blog_publication_media, public.arnaud_blog_publications,
  public.arnaud_blog_revisions, public.arnaud_blog_media, public.arnaud_blog_posts
  in access exclusive mode;
do $$
begin
  if exists (select 1 from public.arnaud_blog_posts)
    or exists (select 1 from public.arnaud_blog_revisions)
    or exists (select 1 from public.arnaud_blog_publications)
    or exists (select 1 from public.arnaud_blog_media)
    or exists (select 1 from public.arnaud_blog_publication_media) then
    raise exception 'Legacy journal is not empty; run the separately approved reset first';
  end if;
end $$;
drop function public.arnaud_publish_blog_post(uuid, integer, uuid[]);
drop function public.arnaud_unpublish_blog_post(uuid, integer);
drop function public.arnaud_save_blog_post(uuid, integer, jsonb, uuid);
drop policy arnaud_blog_media_read on public.arnaud_blog_media;
drop table public.arnaud_blog_publication_media;
drop table public.arnaud_blog_publications;
drop table public.arnaud_blog_revisions;
drop table public.arnaud_blog_media;
drop table public.arnaud_blog_posts;
notify pgrst, 'reload schema';
commit;
