import { getPayload } from "payload";
import { adminErrorResponse, AdminRequestError, readAdminJson } from "../admin/server";
import { provisionIdentity } from "./auth";
import { accessToken, assertOrigin, authClient, cmsEnabled, cookie, cookieNames, sessionCookies, verifyToken } from "./session";

export async function authBridge(request: Request, action: "login" | "me" | "refresh" | "logout") {
  if (!cmsEnabled()) return new Response(null, { status: 404 });
  try {
    if (action !== "me") assertOrigin(request.headers);
    if (action === "logout") {
      const token = accessToken(request.headers);
      // Local sign-out revokes this Supabase session, not every device/site.
      if (token) await authClient().auth.admin.signOut(token, "local");
      return sessionCookies(Response.json({ message: "Signed out.", user: null }, { headers: { "Cache-Control": "no-store" } }));
    }
    let identity;
    let session;
    if (action === "me") identity = await verifyToken(accessToken(request.headers));
    else {
      const client = authClient();
      if (action === "login") {
        const input = await readAdminJson(request);
        if (typeof input.email !== "string" || typeof input.password !== "string") throw new AdminRequestError("Supply your email and password.", 400);
        const result = await client.auth.signInWithPassword({ email: input.email.trim(), password: input.password });
        session = result.data.session;
      } else {
        // Refresh is cookie-only; an explicit malformed bearer is not ignored.
        if (request.headers.has("authorization")) throw new AdminRequestError("Use the admin session to refresh.", 401);
        const refresh_token = cookie(request.headers, cookieNames().refresh);
        if (!refresh_token) throw new AdminRequestError("Sign in again.", 401);
        const result = await client.auth.refreshSession({ refresh_token });
        session = result.data.session;
      }
      identity = session ? await verifyToken(session.access_token) : null;
    }
    if (!identity) throw new AdminRequestError("Sign-in failed or this account cannot access Arnaud’s admin.", 401);
    const { default: config } = await import("../../payload.config");
    const payload = await getPayload({ config });
    if (action !== "me") await provisionIdentity(payload, identity);
    else {
      const found = await payload.find({ collection: "cms-users", where: { id: { equals: identity.id } }, limit: 1, overrideAccess: true });
      if (!found.docs.length) throw new AdminRequestError("Sign in again.", 401);
    }
    const response = Response.json({ user: { id: identity.id, email: identity.email, collection: "cms-users" }, exp: identity.exp }, { headers: { "Cache-Control": "no-store" } });
    return session ? sessionCookies(response, { ...session, expires_at: identity.exp }) : response;
  } catch (error) {
    const response = adminErrorResponse(error);
    return error instanceof AdminRequestError && error.status === 401 ? sessionCookies(response) : response;
  }
}
