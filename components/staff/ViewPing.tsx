"use client";

import { useEffect } from "react";

/** Counts a profile view once per browser session. Cheap, and good enough for a "views" number. */
export function ViewPing({ username }: { username: string }) {
  useEffect(() => {
    const key = `s98-view-${username}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {}
    fetch(`/api/staff/${encodeURIComponent(username)}/view`, { method: "POST" }).catch(() => {});
  }, [username]);
  return null;
}
