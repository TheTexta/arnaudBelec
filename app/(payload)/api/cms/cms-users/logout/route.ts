import { authBridge } from "@/lib/cms/bridge";
export const POST = (request: Request) => authBridge(request, "logout");
