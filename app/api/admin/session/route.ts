import { adminErrorResponse, authorizeAdmin } from "@/lib/admin/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { user } = await authorizeAdmin(request);
    return Response.json({ id: user.id, email: user.email }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
