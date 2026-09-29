import { randomUUID } from "node:crypto";
import { adminErrorResponse, AdminRequestError, authorizeAdmin } from "@/lib/admin/server";
import { createUploadTicket, storagePathFor } from "@/lib/admin/upload-ticket";
import { validateFileSize, validateFilename } from "@/lib/admin/validation";
import { PHOTOGRAPH_BUCKET } from "@/lib/photographs/config.mjs";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { user, service, serviceRoleKey } = await authorizeAdmin(request);
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 4096) throw new AdminRequestError("The upload request is too large.", 413);

    let input: { filename?: unknown; size?: unknown };
    try {
      input = await request.json();
    } catch {
      throw new AdminRequestError("Supply a valid upload request.", 400);
    }
    let filename: string;
    let size: number;
    try {
      ({ filename } = validateFilename(input?.filename));
      size = validateFileSize(input?.size);
    } catch (error) {
      throw new AdminRequestError(error instanceof Error ? error.message : "Invalid file.", 400);
    }

    const { data: duplicate, error: lookupError } = await service.from("arnaud_photographs")
      .select("id").eq("filename", filename).maybeSingle();
    if (lookupError) throw lookupError;
    if (duplicate) throw new AdminRequestError("A photograph with this filename is already published.", 409);

    const ticket = {
      photographId: randomUUID(),
      filename,
      size,
      userId: user.id,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    };
    const path = storagePathFor(ticket);
    const { data, error } = await service.storage.from(PHOTOGRAPH_BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw error ?? new Error("No signed upload token was returned.");

    return Response.json({
      ticket: createUploadTicket(ticket, serviceRoleKey),
      path,
      token: data.token,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
