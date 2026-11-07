import config from "@payload-config";
import { REST_GET, REST_POST, REST_PATCH, REST_DELETE, REST_OPTIONS } from "@payloadcms/next/routes";
import { cmsEnabled } from "@/lib/cms/session";
import { privateRestoreRequest } from "@/lib/cms/restore";

export const runtime = "nodejs";
export const maxDuration = 300;
type Handler = ReturnType<typeof REST_GET>;
const guard = (handler: Handler): Handler => async (request, context) => {
  if (!cmsEnabled()) return new Response(null, { status: 404 });
  const { slug } = await context.params;
  // Supabase alone owns authentication. Explicit bridge routes handle me,
  // refresh and logout; no Payload login/bootstrap/reset/API-key route is exposed.
  if (slug?.[0] === "cms-users" && slug.length > 1 && !/^[0-9a-f-]{36}$/.test(slug[1])) return new Response(null, { status: 404 });
  request = privateRestoreRequest(request, slug);
  const response = await handler(request, context);
  // The S3 adapter's signed-download branch bypasses upload response headers.
  // Never cache a capability redirect across publication or session changes.
  if (slug?.[0] === "media") {
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.append("Vary", "Cookie, Authorization");
  }
  return response;
};
export const GET = guard(REST_GET(config));
export const POST = guard(REST_POST(config));
export const PATCH = guard(REST_PATCH(config));
export const DELETE = guard(REST_DELETE(config));
export const OPTIONS = guard(REST_OPTIONS(config));
