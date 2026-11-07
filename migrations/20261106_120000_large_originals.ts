import { sql, type MigrateUpArgs } from "@payloadcms/db-postgres";

// Operator journal only, deliberately not a Payload collection or generated snapshot.
export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
DO $$ BEGIN
  IF current_user NOT IN ('arnaud_cms_owner', 'arnaud_cms_migrator') THEN
    RAISE EXCEPTION 'Large-original migration requires the Arnaud owner or migrator role';
  END IF;
  IF to_regclass('arnaud_cms.media') IS NULL OR to_regclass('arnaud_cms.cms_users') IS NULL
     OR to_regclass('arnaud_cms.videos') IS NULL OR to_regclass('arnaud_cms.fashion_projects') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='arnaud_cms' AND table_name='media' AND column_name='upload_identity') THEN
    RAISE EXCEPTION 'Large-original migration requires native journal and category tables';
  END IF;
END $$;
CREATE TABLE arnaud_cms.media_imports (
  id uuid PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES arnaud_cms.cms_users(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL UNIQUE CHECK (length(idempotency_key) BETWEEN 1 AND 200),
  original_filename text NOT NULL CHECK (length(original_filename) BETWEEN 1 AND 1000),
  expected_bytes bigint NOT NULL CHECK (expected_bytes BETWEEN 1 AND 8589934592),
  expected_sha256 text NOT NULL CHECK (expected_sha256 ~ '^[a-f0-9]{64}$'),
  source_identity jsonb NOT NULL,
  bucket text NOT NULL DEFAULT 'arnaudbelec-staging' CHECK (bucket = 'arnaudbelec-staging'),
  filename text NOT NULL UNIQUE CHECK (filename = id::text || '.mp4'),
  object_key text NOT NULL UNIQUE CHECK (object_key = 'journal-native/large-originals/' || id::text || '/' || filename),
  upload_id text,
  part_size bigint NOT NULL DEFAULT 67108864 CHECK (part_size = 67108864),
  state text NOT NULL DEFAULT 'reserved' CHECK (state IN ('reserved','uploading','uploaded','verifying','verified','registered','recoverable_error')),
  observed_bytes bigint CHECK (observed_bytes BETWEEN 1 AND 8589934592),
  observed_sha256 text CHECK (observed_sha256 ~ '^[a-f0-9]{64}$'),
  observed_mime text CHECK (observed_mime = 'video/mp4'),
  observed_etag text,
  probe jsonb NOT NULL,
  lease_token uuid,
  lease_until timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text CHECK (last_error IN ('operator_interrupted')),
  media_id uuid UNIQUE REFERENCES arnaud_cms.media(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (state NOT IN ('verified','registered') OR
    (observed_bytes = expected_bytes AND observed_sha256 = expected_sha256 AND observed_mime = 'video/mp4' AND observed_etag IS NOT NULL
     AND observed_bytes IS NOT NULL AND observed_sha256 IS NOT NULL AND observed_mime IS NOT NULL)),
  CHECK ((state = 'registered') = (media_id IS NOT NULL))
);
CREATE INDEX media_imports_actor_idx ON arnaud_cms.media_imports(actor_id);
CREATE FUNCTION arnaud_cms.guard_media_import_identity() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF ROW(NEW.id,NEW.actor_id,NEW.idempotency_key,NEW.original_filename,NEW.expected_bytes,NEW.expected_sha256,NEW.source_identity,NEW.bucket,NEW.filename,NEW.object_key,NEW.part_size,NEW.probe)
     IS DISTINCT FROM ROW(OLD.id,OLD.actor_id,OLD.idempotency_key,OLD.original_filename,OLD.expected_bytes,OLD.expected_sha256,OLD.source_identity,OLD.bucket,OLD.filename,OLD.object_key,OLD.part_size,OLD.probe) THEN
    RAISE EXCEPTION 'Original import identity is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER media_import_identity BEFORE UPDATE ON arnaud_cms.media_imports FOR EACH ROW EXECUTE FUNCTION arnaud_cms.guard_media_import_identity();
REVOKE ALL ON arnaud_cms.media_imports FROM PUBLIC, arnaud_cms_runtime, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION arnaud_cms.guard_media_import_identity() FROM PUBLIC, arnaud_cms_runtime, anon, authenticated, service_role;
GRANT ALL ON arnaud_cms.media_imports TO arnaud_cms_owner, arnaud_cms_migrator;
`);
}

export async function down() {
  throw new Error("Original-import recovery records must be retained; use a separately reviewed recovery plan.");
}
