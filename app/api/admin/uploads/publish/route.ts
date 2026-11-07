import { analyseImage, imageMetadata } from "@/lib/photographs/analyse-image.mjs";
import { PHOTOGRAPH_BUCKET } from "@/lib/photographs/config.mjs";
import { adminErrorResponse, AdminRequestError, authorizeAdmin } from "@/lib/admin/server";
import { storagePathFor, verifyUploadTicket } from "@/lib/admin/upload-ticket";
import { capturedDate, optionalText, sortOrder, validateDimensions, validateFilename } from "@/lib/admin/validation";
import { reservationFor, verifyAndPromote } from "@/lib/admin/r2-upload";
import { r2Storage } from "@/lib/photographs/storage.mjs";
import { MAXIMUM_SAMPLE_BYTES } from "@/lib/palette/config.mjs";
import { validateImageSample } from "@/lib/admin/image-sample.mjs";

export const runtime = "nodejs";
export const maxDuration = 300;

function responseForPublished(filename: string) {
  return Response.json({ filename, href: `/photos/${encodeURIComponent(filename)}` }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  try {
    const { user, service, serviceRoleKey } = await authorizeAdmin(request);
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 1_000_000) throw new AdminRequestError("The image sample is too large.", 413);

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new AdminRequestError("Supply a valid image sample and metadata.", 400);
    }
    let ticket;
    try {
      ticket = verifyUploadTicket(form.get("ticket"), serviceRoleKey, user.id);
    } catch (error) {
      throw new AdminRequestError(error instanceof Error ? error.message : "The upload ticket is invalid.", 400, "ticket_invalid");
    }
    const path = storagePathFor(ticket);
    const { format } = validateFilename(ticket.filename);
    const bucket = service.storage.from(PHOTOGRAPH_BUCKET);
    const isR2 = ticket.provider === "r2";
    if (isR2) await reservationFor(service, ticket);

    const { data: alreadyPublished, error: existingError } = await service.from("arnaud_photographs")
      .select("filename,storage_path").eq("id", ticket.photographId).maybeSingle();
    if (existingError) throw existingError;
    if (alreadyPublished) {
      if (alreadyPublished.storage_path !== path || alreadyPublished.filename !== ticket.filename) {
        throw new AdminRequestError("The upload ticket conflicts with a published photograph.", 409);
      }
      return responseForPublished(ticket.filename);
    }

    const { data: object, error: objectError } = isR2
      ? { data: { size: ticket.size, contentType: format.contentType }, error: null }
      : await bucket.info(path);
    if (objectError || !object) throw new AdminRequestError("The uploaded file is missing. Retry the upload.", 409, "upload_missing");

    try {
      if (object.size !== ticket.size || object.contentType !== format.contentType) {
        throw new AdminRequestError("The uploaded file does not match the selected image.", 400);
      }
      let dimensions: { width: number; height: number };
      let capturedAt: string | null;
      let title: string | null;
      let altText: string | null;
      let order: number | null;
      try {
        dimensions = validateDimensions(Number(form.get("width")), Number(form.get("height")));
        capturedAt = capturedDate(form.get("capturedAt"), ticket.filename);
        title = optionalText(form.get("title"), 200, "Title");
        altText = optionalText(form.get("altText"), 500, "Alt text");
        order = sortOrder(form.get("sortOrder"));
      } catch (error) {
        throw new AdminRequestError(error instanceof Error ? error.message : "Invalid photograph details.", 400);
      }
      const sample = form.get("sample");
      if (!(sample instanceof File) || sample.size < 1 || sample.size > MAXIMUM_SAMPLE_BYTES) {
        throw new AdminRequestError("Create a valid image sample before publishing.", 400);
      }
      const sampleBuffer = Buffer.from(await sample.arrayBuffer());
      let sampleMetadata;
      try {
        sampleMetadata = await imageMetadata(sampleBuffer);
      } catch {
        throw new AdminRequestError("The image sample could not be read.", 400);
      }
      let sampleLongestSide;
      try {
        sampleLongestSide = validateImageSample(sampleMetadata, dimensions);
      } catch (error) {
        throw new AdminRequestError(error instanceof Error ? error.message : "Invalid image sample.", 400);
      }

      let analysis;
      try {
        analysis = await analyseImage(sampleBuffer, ticket.photographId, { sampleLongestSide });
      } catch {
        throw new AdminRequestError("The image sample could not be analysed.", 400);
      }
      const rpcArguments = {
        p_photograph_id: ticket.photographId,
        p_storage_path: path,
        p_filename: ticket.filename,
        p_image_width: dimensions.width,
        p_image_height: dimensions.height,
        p_captured_at: capturedAt,
        p_title: title,
        p_alt_text: altText,
        p_sort_order: order,
        p_algorithm: analysis.algorithm,
        p_algorithm_iterations: analysis.algorithm_iterations,
        p_sample_longest_side: analysis.sample_longest_side,
        p_palette_size: analysis.palette_size,
        p_analyzed_at: analysis.analyzed_at,
        p_background_hex: analysis.background_hex,
        p_colours: analysis.colours,
      };
      if (isR2) await verifyAndPromote(service, ticket);
      const { error: publishError } = isR2
        ? await service.rpc("arnaud_publish_r2_photograph", { p_reservation_id: ticket.photographId, p_metadata: rpcArguments })
        : await service.rpc("arnaud_publish_photograph", rpcArguments);
      if (publishError) throw publishError;
      if (isR2) {
        try { await r2Storage().removeStaging(path); }
        catch { console.error("Published Arnaud upload retained a private staging recovery object."); }
      }
      return responseForPublished(ticket.filename);
    } catch (error) {
      // R2 failures are recoverable, including ambiguous RPC responses. Never
      // delete a promoted original here or compete with another finalizer.
      if (isR2) throw error;
      // A retry may race a successful publication. Never remove a published object.
      const { data: published, error: recheckError } = await service.from("arnaud_photographs")
        .select("filename,storage_path").eq("id", ticket.photographId).maybeSingle();
      if (recheckError) throw recheckError;
      if (published?.storage_path === path && published.filename === ticket.filename) {
        return responseForPublished(ticket.filename);
      }
      const { error: cleanupError } = await bucket.remove([path]);
      if (cleanupError) {
        console.error("Photo admin could not clean up an unpublished upload:", cleanupError);
        throw new AdminRequestError("Publication failed and the uploaded file could not be removed. Contact the site administrator.", 502);
      }
      if (error instanceof AdminRequestError) throw new AdminRequestError(error.message, error.status, "upload_removed");
      if (error && typeof error === "object" && "code" in error && error.code === "23505") {
        throw new AdminRequestError("A photograph with this filename was published while this upload was in progress.", 409, "upload_removed");
      }
      console.error("Photo admin publication failed:", error);
      throw new AdminRequestError("The photograph could not be published. The upload was removed.", 502, "upload_removed");
    }
  } catch (error) {
    return adminErrorResponse(error);
  }
}
