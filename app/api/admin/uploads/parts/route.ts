import { authorizeAdmin, adminErrorResponse, AdminRequestError, readAdminJson } from "@/lib/admin/server";
import { verifyUploadTicket, storagePathFor } from "@/lib/admin/upload-ticket";
import { reservationFor } from "@/lib/admin/r2-upload";
import { PART_SIZE, r2Storage } from "@/lib/photographs/storage.mjs";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { user, service, serviceRoleKey } = await authorizeAdmin(request);
    const input = await readAdminJson(request);
    let ticket;
    try { ticket = verifyUploadTicket(input.ticket, serviceRoleKey, user.id); }
    catch { throw new AdminRequestError("The upload ticket is invalid or expired. Select the file again.", 400, "ticket_invalid"); }
    const reservation = await reservationFor(service, ticket);
    if (reservation.state !== "uploading") return Response.json({ complete: true }, { headers: { "Cache-Control": "no-store" } });
    if (!reservation.multipart_id) throw new AdminRequestError("The multipart upload is not initialized.", 409);
    const storage = r2Storage();
    if (await storage.head(storagePathFor(ticket), true)) return Response.json({ complete: true }, { headers: { "Cache-Control": "no-store" } });
    if (input.partNumber === undefined) {
      const parts = await storage.parts(storagePathFor(ticket), reservation.multipart_id);
      return Response.json({ parts: parts.map(({ PartNumber, Size }) => ({ number: PartNumber, size: Size })), partSize: PART_SIZE }, { headers: { "Cache-Control": "no-store" } });
    }
    if (typeof input.partNumber !== "number" || !Number.isInteger(input.partNumber) || input.partNumber < 1 || input.partNumber > Math.ceil(ticket.size / PART_SIZE)) throw new AdminRequestError("Invalid upload part.", 400);
    const url = await storage.signPart(storagePathFor(ticket), reservation.multipart_id, input.partNumber);
    return Response.json({ url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return adminErrorResponse(error); }
}
