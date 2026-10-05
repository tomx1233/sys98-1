"use client";

import { useState } from "react";
import { useT } from "@/components/LangProvider";

export function CopyButton({ text, className = "btn btn-line btn-sm" }: { text: string; className?: string }) {
  const t = useT();
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1600);
    } catch {
      window.prompt("Copy:", text);
    }
  }

  return (
    <button type="button" className={className} onClick={copy}>
      {done ? t("common.copied") : t("common.copy")}
    </button>
  );
}
