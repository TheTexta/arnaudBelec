import { AdminRequestError } from "../admin/server";
export function assertLegacyJournalWrite() {
  throw new AdminRequestError("The legacy journal has been retired. Open /cms to write a new post.", 410, "journal_retired");
}

export function retiredJournalResponse() {
  return Response.json({ error: "The legacy journal has been retired. Open /cms.", code: "journal_retired" }, { status: 410, headers: { "Cache-Control": "private, no-store" } });
}
