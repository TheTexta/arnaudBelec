"use client";
import { useEffect } from "react";

export function RetiredJournalCleanup() {
  useEffect(() => {
    // Clear only the retired journal's browser copies, never Supabase sessions,
    // photographs or another site's data. Offline devices clear on reconnection.
    for (const storageName of ["localStorage", "sessionStorage"] as const) {
      try {
        const storage = window[storageName];
        for (const key of Object.keys(storage)) {
          if (key.startsWith("arnaud-blog-draft-v1:") || key.startsWith("arnaud-blog-upload-v1:")) storage.removeItem(key);
        }
      } catch { /* Private browsing may deny access to browser storage. */ }
    }
  }, []);
  return null;
}
