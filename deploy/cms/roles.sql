-- APPROVAL REQUIRED. Run as the database owner, not from the application.
-- Passwords are assigned separately through a secure operator channel.
-- These roles must not inherit service_role, authenticated, or other site roles.
begin;
create role arnaud_cms_owner nologin nosuperuser nocreatedb nocreaterole nobypassrls;
create role arnaud_cms_migrator login nosuperuser nocreatedb nocreaterole nobypassrls;
create role arnaud_cms_runtime login nosuperuser nocreatedb nocreaterole nobypassrls;
alter role arnaud_cms_runtime connection limit 6;
alter role arnaud_cms_runtime set statement_timeout = '30s';
alter role arnaud_cms_runtime set lock_timeout = '5s';
alter role arnaud_cms_runtime set idle_in_transaction_session_timeout = '15s';
grant arnaud_cms_owner to arnaud_cms_migrator;
create schema arnaud_cms authorization arnaud_cms_owner;
revoke all on schema arnaud_cms from public, anon, authenticated;
grant usage on schema arnaud_cms to arnaud_cms_runtime;
alter default privileges for role arnaud_cms_owner in schema arnaud_cms grant select, insert, update, delete on tables to arnaud_cms_runtime;
alter default privileges for role arnaud_cms_owner in schema arnaud_cms grant usage, select on sequences to arnaud_cms_runtime;
-- SET ROLE owner is recommended for migrations, but grants remain correct when
-- the migrator creates objects under its own identity instead.
alter default privileges for role arnaud_cms_migrator in schema arnaud_cms grant select, insert, update, delete on tables to arnaud_cms_runtime;
alter default privileges for role arnaud_cms_migrator in schema arnaud_cms grant usage, select on sequences to arnaud_cms_runtime;
grant usage on schema public to arnaud_cms_runtime;
grant select, insert, update on public.arnaud_blog_posts, public.arnaud_blog_revisions, public.arnaud_blog_media to arnaud_cms_runtime;
grant select, insert, update, delete on public.arnaud_blog_publications, public.arnaud_blog_publication_media to arnaud_cms_runtime;
grant execute on function public.arnaud_save_blog_post(uuid, integer, jsonb, uuid), public.arnaud_publish_blog_post(uuid, integer, uuid[]), public.arnaud_unpublish_blog_post(uuid, integer) to arnaud_cms_runtime;
-- Runtime is a trusted, site-scoped backend role, never a browser/JWT role.
create policy arnaud_cms_backend on public.arnaud_blog_posts for all to arnaud_cms_runtime using (true) with check (true);
create policy arnaud_cms_backend on public.arnaud_blog_revisions for all to arnaud_cms_runtime using (true) with check (true);
create policy arnaud_cms_backend on public.arnaud_blog_media for all to arnaud_cms_runtime using (true) with check (true);
create policy arnaud_cms_backend on public.arnaud_blog_publications for all to arnaud_cms_runtime using (true) with check (true);
create policy arnaud_cms_backend on public.arnaud_blog_publication_media for all to arnaud_cms_runtime using (true) with check (true);
-- Import reads only these Arnaud tables. No shared auth/storage grants.
grant usage on schema public to arnaud_cms_owner;
grant select on public.arnaud_blog_posts, public.arnaud_blog_revisions, public.arnaud_blog_publications, public.arnaud_blog_media to arnaud_cms_owner;
create policy arnaud_cms_import on public.arnaud_blog_posts for select to arnaud_cms_owner using (true);
create policy arnaud_cms_import on public.arnaud_blog_revisions for select to arnaud_cms_owner using (true);
create policy arnaud_cms_import on public.arnaud_blog_publications for select to arnaud_cms_owner using (true);
create policy arnaud_cms_import on public.arnaud_blog_media for select to arnaud_cms_owner using (true);
commit;
