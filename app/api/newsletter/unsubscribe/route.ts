import { tokenPage } from "@/lib/newsletter/http";
export const runtime = "nodejs";
export const GET = (request: Request) => tokenPage(request, "unsubscribe");
export const POST = (request: Request) => tokenPage(request, "unsubscribe");
