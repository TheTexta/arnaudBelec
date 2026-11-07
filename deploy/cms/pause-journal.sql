-- Approved cutover window only. Retain a private exact service_role ACL snapshot
-- and generate/test its resume grants BEFORE applying this file. No other site's
-- tables/functions, public reads, photograph tools or media objects are touched.
BEGIN;
SET LOCAL lock_timeout = '5s';
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON
  public.arnaud_blog_posts, public.arnaud_blog_revisions,
  public.arnaud_blog_publications, public.arnaud_blog_media,
  public.arnaud_blog_publication_media FROM service_role;
REVOKE EXECUTE ON FUNCTION
  public.arnaud_save_blog_post(uuid,integer,jsonb,uuid),
  public.arnaud_publish_blog_post(uuid,integer,uuid[]),
  public.arnaud_unpublish_blog_post(uuid,integer) FROM service_role;
DO $pause$
BEGIN
  IF EXISTS (
    SELECT FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace
      AND c.relname IN ('arnaud_blog_posts','arnaud_blog_revisions','arnaud_blog_publications','arnaud_blog_media','arnaud_blog_publication_media')
      AND has_table_privilege('service_role',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE')
  ) THEN RAISE EXCEPTION 'Legacy journal writer still has mutation privileges'; END IF;
END;
$pause$;
COMMIT;
