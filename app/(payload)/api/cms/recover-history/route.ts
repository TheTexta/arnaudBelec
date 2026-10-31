import { createLocalReq, getPayload } from "payload";
import config from "@payload-config";
import { adminErrorResponse, AdminRequestError, readAdminJson } from "@/lib/admin/server";
import { isCmsUser } from "@/lib/cms/auth";
import { assertOrigin, cmsEnabled } from "@/lib/cms/session";
import { validateDocument } from "@/lib/blog/document";

export async function POST(request: Request) {
  if (!cmsEnabled()) return new Response(null, { status: 404 });
  try {
    assertOrigin(request.headers);
    const payload = await getPayload({ config });
    const { user } = await payload.auth({ headers: request.headers });
    if (!user || !isCmsUser(user)) throw new AdminRequestError("Sign in to recover a revision.", 401);
    const input = await readAdminJson(request);
    if (typeof input.id !== "string" || !Number.isSafeInteger(input.version)) throw new AdminRequestError("Choose a revision and current recovery version.", 400);
    const req = await createLocalReq({ user }, payload);
    const revision = await payload.findByID({ collection: "legacy-revisions", id: input.id, req, overrideAccess: false });
    const current = await payload.findByID({ collection: "posts", id: revision.postId, draft: true, req, overrideAccess: false });
    const document = validateDocument(revision.snapshot);
    if (current.firstPublishedAt) document.slug = String(current.slug);
    const doc = await payload.update({ collection: "posts", id: revision.postId, draft: true, req, overrideAccess: false, data: { ...document, legacyVersion: Number(input.version), _status: "draft" } });
    return Response.json({ id: doc.id }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return adminErrorResponse(error); }
}
