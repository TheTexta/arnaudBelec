-- Arnaud journal only. Output contains private writing/media metadata: retain
-- privately, never print it or commit it. Hash the full rows outside Postgres.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL timezone = 'UTC';
SELECT jsonb_build_object(
  'posts', (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY id), '[]'::jsonb) FROM public.arnaud_blog_posts p),
  'revisions', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY post_id, version), '[]'::jsonb) FROM public.arnaud_blog_revisions r),
  'publications', (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY id), '[]'::jsonb) FROM public.arnaud_blog_publications p),
  'media', (SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY id), '[]'::jsonb) FROM public.arnaud_blog_media m),
  'publication_media', (SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY post_id, media_id), '[]'::jsonb) FROM public.arnaud_blog_publication_media m)
);
ROLLBACK;
