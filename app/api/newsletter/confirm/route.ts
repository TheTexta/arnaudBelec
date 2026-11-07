import { tokenPage } from "@/lib/newsletter/http";
export const runtime = "nodejs";
export const GET = (request: Request) => tokenPage(request, "confirm");
export const POST = (request: Request) => tokenPage(request, "confirm");
