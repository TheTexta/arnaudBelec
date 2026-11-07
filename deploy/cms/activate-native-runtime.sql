-- OPERATOR ONLY, after approved reset, native migration, exact SCRAM credential
-- rotation in PostgreSQL and the dedicated gateway, and old-client drainage.
BEGIN;
DO $check$
DECLARE t record; p record;
BEGIN
  IF to_regclass('arnaud_cms.media') IS NULL
     OR to_regclass('arnaud_cms.legacy_revisions') IS NOT NULL THEN
    RAISE EXCEPTION 'Native schema migration is incomplete';
  END IF;
  FOR t IN SELECT oid FROM pg_class WHERE relnamespace = 'public'::regnamespace
    AND relname IN ('arnaud_blog_posts','arnaud_blog_revisions','arnaud_blog_publications','arnaud_blog_media','arnaud_blog_publication_media') LOOP
    IF has_table_privilege('arnaud_cms_runtime',t.oid,'INSERT,UPDATE,DELETE,TRUNCATE')
       OR has_any_column_privilege('arnaud_cms_runtime',t.oid,'INSERT,UPDATE') THEN
      RAISE EXCEPTION 'Runtime still has legacy mutation access';
    END IF;
  END LOOP;
  FOR p IN SELECT oid FROM pg_proc WHERE pronamespace = 'public'::regnamespace
    AND proname IN ('arnaud_save_blog_post','arnaud_publish_blog_post','arnaud_unpublish_blog_post') LOOP
    IF has_function_privilege('arnaud_cms_runtime',p.oid,'EXECUTE') THEN
      RAISE EXCEPTION 'Runtime still has legacy routine access';
    END IF;
  END LOOP;
END $check$;
GRANT USAGE ON SCHEMA arnaud_cms TO arnaud_cms_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA arnaud_cms TO arnaud_cms_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA arnaud_cms TO arnaud_cms_runtime;
ALTER ROLE arnaud_cms_runtime LOGIN;
COMMIT;
