import { AdminRequestError } from "../admin/server";
import { cmsEnabled } from "./session";

export function assertLegacyJournalWrite() {
  if (cmsEnabled()) throw new AdminRequestError("Journal editing has moved to /cms. Reload there before saving.", 409, "cms_cutover");
}
