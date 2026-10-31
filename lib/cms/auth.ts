import type { AuthStrategy, Payload } from "payload";
import { accessToken, allowedUser, cmsEnabled, verifyToken } from "./session";

export function isCmsUser(user: unknown): boolean {
  if (!user || typeof user !== "object") return false;
  const value = user as Record<string, unknown>;
  return value.collection === "cms-users" && value._strategy === "supabase" && allowedUser(value.id);
}

export const supabaseStrategy: AuthStrategy = {
  name: "supabase",
  authenticate: async ({ headers, payload, req }) => {
    if (!cmsEnabled()) return { user: null };
    const token = accessToken(headers, !!req?.method && !["GET", "HEAD", "OPTIONS"].includes(req.method));
    const identity = await verifyToken(token);
    if (!identity) return { user: null };
    const found = await payload.find({ collection: "cms-users", where: { id: { equals: identity.id } }, limit: 1, depth: 0, overrideAccess: true });
    if (!found.docs.length) return { user: null };
    return { user: { ...found.docs[0], id: identity.id, email: identity.email, exp: identity.exp, collection: "cms-users", _strategy: "supabase" } };
  },
};

// Only called after server-side Supabase verification. This is an identity map,
// never a new password, registration path, or independent source of permissions.
export async function provisionIdentity(payload: Payload, identity: { id: string; email: string }) {
  const found = await payload.find({ collection: "cms-users", where: { id: { equals: identity.id } }, limit: 1, overrideAccess: true });
  if (found.docs.length) return found.docs[0];
  try { return await payload.create({ collection: "cms-users", data: { id: identity.id, email: identity.email }, overrideAccess: true }); }
  catch (error) {
    const raced = await payload.find({ collection: "cms-users", where: { id: { equals: identity.id } }, limit: 1, overrideAccess: true });
    if (raced.docs.length) return raced.docs[0];
    throw error;
  }
}
