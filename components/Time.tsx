"use client";

import { useSyncExternalStore } from "react";
import { useLang } from "@/components/LangProvider";

const noop = () => () => {};

function relative(iso: string, lang: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  const min = 60_000, hour = 3_600_000, day = 86_400_000;
  if (abs < min) return rtf.format(0, "second");
  if (abs < hour) return rtf.format(Math.round(diff / min), "minute");
  if (abs < day) return rtf.format(Math.round(diff / hour), "hour");
  if (abs < 14 * day) return rtf.format(Math.round(diff / day), "day");
  return new Date(iso).toLocaleDateString(lang, { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Renders a timestamp in the visitor's own timezone. The server only knows UTC, so the first
 * paint shows the plain date and the client swaps in the local formatting.
 */
export function Time({ iso, mode = "rel" }: { iso: string; mode?: "rel" | "full" | "date" }) {
  const { lang } = useLang();
  const text = useSyncExternalStore(
    noop,
    () => {
      const d = new Date(iso);
      if (mode === "rel") return relative(iso, lang);
      if (mode === "date") return d.toLocaleDateString(lang, { day: "numeric", month: "short", year: "numeric" });
      return d.toLocaleString(lang, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    },
    () => iso.slice(0, 10)
  );
  return (
    <time dateTime={iso} title={new Date(iso).toISOString()} suppressHydrationWarning>
      {text}
    </time>
  );
}
