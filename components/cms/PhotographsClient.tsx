"use client";

import { useCallback, useMemo, useState } from "react";
import AdminPanel from "@/app/admin/admin-panel";
import { SiteAdminProvider } from "@/app/admin/admin-access";
import { cmsRequest } from "./request";

export function PhotographsClient({ userId, email }: { userId: string; email: string }) {
  const [warning, setNavigationWarning] = useState<string | null>(null);
  const confirmNavigation = useCallback((event: React.MouseEvent<HTMLAnchorElement>) => { if (warning && !window.confirm(warning)) event.preventDefault(); }, [warning]);
  const access = useMemo(() => ({ userId, email, request: cmsRequest, setNavigationWarning, confirmNavigation }), [userId, email, confirmNavigation]);
  return <SiteAdminProvider value={access}><div className="blog-admin cms-photographs"><AdminPanel /></div></SiteAdminProvider>;
}
