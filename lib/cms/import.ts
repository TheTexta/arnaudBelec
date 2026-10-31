import { createHash } from "node:crypto";
import { createLocalReq, type Payload } from "payload";
import { sql, type PostgresAdapter } from "@payloadcms/db-postgres";
import { validateDocument, type BlogDocument } from "../blog/document";
import { CMS_IMPORT } from "./posts";

type SourcePost = BlogDocument & { id: string; version: number; created_at: string; updated_at: string; first_published_at: string | null };
type Publication = BlogDocument & { id: string; source_version: number; published_at: string; updated_at: string };
type Revision = { post_id: string; version: number; snapshot: BlogDocument; saved_by: string; saved_at: string };

export async function importLegacy(payload: Payload, apply = false) {
  const req = await createLocalReq({ context: { cmsImport: CMS_IMPORT } }, payload);
  const transactionId = await payload.db.beginTransaction({ isolationLevel: "repeatable read" });
  if (!transactionId) throw new Error("An import requires a database transaction.");
  req.transactionID = transactionId;
  const db = payload.db.sessions![transactionId].db as PostgresAdapter["drizzle"];
  try {
    // The import never uses the Supabase API, remote credentials, R2, or a dump.
    // It reads the authoritative legacy tables in the SAME approved database.
    const posts = (await db.execute(sql`select *, created_at::text, updated_at::text, first_published_at::text from public.arnaud_blog_posts order by id`)).rows as SourcePost[];
    const publications = (await db.execute(sql`select *, published_at::text, updated_at::text from public.arnaud_blog_publications order by id`)).rows as Publication[];
    const revisions = (await db.execute(sql`select *, saved_at::text from public.arnaud_blog_revisions order by post_id, version`)).rows as Revision[];
    const media = (await db.execute(sql`select id, post_id, storage_path, state, sha256, source_etag, published_etag from public.arnaud_blog_media order by id`)).rows;
    for (const item of [...posts, ...publications]) validateDocument(item);
    for (const item of revisions) validateDocument(item.snapshot);
    const digest = createHash("sha256").update(JSON.stringify({ posts, publications, revisions, media })).digest("hex");
    const report = { posts: posts.length, publications: publications.length, revisions: revisions.length, media: media.length, sourceSha256: digest, applied: apply };
    if (!apply) { await payload.db.rollbackTransaction(transactionId); return report; }
    const count = await payload.count({ collection: "posts", req, overrideAccess: true });
    const historyCount = await payload.count({ collection: "legacy-revisions", req, overrideAccess: true });
    if (count.totalDocs || historyCount.totalDocs) throw new Error("Import target is not empty. Refusing to overwrite existing CMS content. Reconcile explicitly.");
    for (const post of posts) {
      const published = publications.find(item => item.id === post.id);
      const common = { id: post.id, legacyVersion: post.version, firstPublishedAt: post.first_published_at, createdAt: post.created_at };
      await payload.create({ collection: "posts", req, overrideAccess: true, data: { ...common, ...validateDocument(published ?? post), updatedAt: post.updated_at, _status: published ? "published" : "draft" } });
      if (published) await payload.update({ collection: "posts", id: post.id, req, draft: true, overrideAccess: true, data: { ...validateDocument(post), legacyVersion: post.version, _status: "draft" } });
    }
    for (const item of revisions) await payload.create({
      collection: "legacy-revisions", req, overrideAccess: true,
      data: { sourceKey: `${item.post_id}:${item.version}`, postId: item.post_id, revision: item.version, snapshot: item.snapshot, savedBy: item.saved_by, savedAt: item.saved_at, sourceTimestamp: item.saved_at },
    });
    const imported = await payload.count({ collection: "posts", req, overrideAccess: true });
    const history = await payload.count({ collection: "legacy-revisions", req, overrideAccess: true });
    if (imported.totalDocs !== posts.length || history.totalDocs !== revisions.length) throw new Error("Import count verification failed.");
    await payload.db.commitTransaction(transactionId);
    return report;
  } catch (error) { await payload.db.rollbackTransaction(transactionId); throw error; }
}
