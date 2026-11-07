-- OPERATOR ONLY, separately approved native cutover. Capture exact role/ACL
-- snapshots first. This intentionally leaves runtime NOLOGIN until activation.
-- Do not restore the legacy writer grants after the native migration.
BEGIN;
ALTER ROLE arnaud_cms_runtime NOLOGIN;
COMMIT;
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE usename = 'arnaud_cms_runtime' AND pid <> pg_backend_pid();

BEGIN;
SET LOCAL lock_timeout = '5s';
LOCK TABLE public.arnaud_blog_posts, public.arnaud_blog_revisions,
  public.arnaud_blog_publications, public.arnaud_blog_media,
  public.arnaud_blog_publication_media IN ACCESS EXCLUSIVE MODE;
DO $fence$
DECLARE t record;
BEGIN
  IF pg_has_role('arnaud_cms_runtime', 'arnaud_cms_owner', 'MEMBER')
     OR pg_has_role('arnaud_cms_runtime', 'arnaud_cms_migrator', 'MEMBER') THEN
    RAISE EXCEPTION 'Runtime inherits a privileged CMS role';
  END IF;
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'arnaud_cms' ORDER BY tablename LOOP
    EXECUTE format('LOCK TABLE arnaud_cms.%I IN ACCESS EXCLUSIVE MODE', t.tablename);
  END LOOP;
END $fence$;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON
  public.arnaud_blog_posts, public.arnaud_blog_revisions,
  public.arnaud_blog_publications, public.arnaud_blog_media,
  public.arnaud_blog_publication_media FROM service_role, arnaud_cms_runtime;
REVOKE EXECUTE ON FUNCTION
  public.arnaud_save_blog_post(uuid,integer,jsonb,uuid),
  public.arnaud_publish_blog_post(uuid,integer,uuid[]),
  public.arnaud_unpublish_blog_post(uuid,integer)
  FROM service_role, arnaud_cms_runtime;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA arnaud_cms
  FROM arnaud_cms_runtime;
DO $verify$
DECLARE r text; t record; p record;
BEGIN
  FOREACH r IN ARRAY ARRAY['service_role', 'arnaud_cms_runtime'] LOOP
    FOR t IN SELECT oid FROM pg_class WHERE relnamespace = 'public'::regnamespace
      AND relname IN ('arnaud_blog_posts','arnaud_blog_revisions','arnaud_blog_publications','arnaud_blog_media','arnaud_blog_publication_media') LOOP
      IF has_table_privilege(r,t.oid,'INSERT,UPDATE,DELETE,TRUNCATE')
         OR has_any_column_privilege(r,t.oid,'INSERT,UPDATE') THEN
        RAISE EXCEPTION 'Legacy journal remains writable by %', r;
      END IF;
    END LOOP;
    FOR p IN SELECT oid FROM pg_proc WHERE pronamespace = 'public'::regnamespace
      AND proname IN ('arnaud_save_blog_post','arnaud_publish_blog_post','arnaud_unpublish_blog_post') LOOP
      IF has_function_privilege(r,p.oid,'EXECUTE') THEN
        RAISE EXCEPTION 'Legacy journal routine remains executable by %', r;
      END IF;
    END LOOP;
  END LOOP;
  FOR t IN SELECT c.oid FROM pg_class c WHERE c.relnamespace = 'arnaud_cms'::regnamespace AND c.relkind IN ('r','p') LOOP
    IF has_table_privilege('arnaud_cms_runtime',t.oid,'INSERT,UPDATE,DELETE,TRUNCATE')
       OR has_any_column_privilege('arnaud_cms_runtime',t.oid,'INSERT,UPDATE') THEN
      RAISE EXCEPTION 'Native journal remains writable';
    END IF;
  END LOOP;
END $verify$;
COMMIT;
