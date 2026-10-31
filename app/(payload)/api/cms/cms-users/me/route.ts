import { authBridge } from "@/lib/cms/bridge";
export const GET = (request: Request) => authBridge(request, "me");
