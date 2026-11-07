"use client";

import { useEffect, type ReactNode } from "react";
import { useTheme } from "@payloadcms/ui";
import { adminThemePreference, systemThemeQuery } from "@/lib/cms/theme";

export function SystemTheme({ children }: { children: ReactNode }) {
  const { autoMode, setTheme } = useTheme();
  useEffect(() => {
    if (autoMode === false) return;
    const media = window.matchMedia(systemThemeQuery);
    const sync = () => {
      if (adminThemePreference(document.cookie) !== "auto") return;
      // Payload 3.92.1 supports "auto" at runtime, but omits it from its public type.
      // @ts-expect-error Native Auto also clears the manual preference cookie.
      setTheme("auto");
    };
    // Payload strips admin.theme from its signed-out client config, so its
    // provider does not initialise Auto on login/logout screens by itself.
    if (autoMode === undefined) {
      const preference = adminThemePreference(document.cookie);
      if (preference !== "auto") { setTheme(preference); return; }
      sync();
    }
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [autoMode, setTheme]);
  return children;
}
