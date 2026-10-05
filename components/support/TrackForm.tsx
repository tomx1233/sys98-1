"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { send } from "@/lib/client";
import { useT } from "@/components/LangProvider";

export function TrackForm() {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    const res = await send<{ path: string }>("/api/support/track", "POST", {
      code: f.get("code"),
      email: f.get("email"),
    });
    if (!res.ok) {
      setBusy(false);
      setError(res.data.error ?? t("common.error"));
      return;
    }
    router.push(res.data.path);
  }

  return (
    <form className="sec form" onSubmit={onSubmit}>
      <p className="muted-p" style={{ marginTop: 0 }}>{t("track.lead")}</p>
      <div className="field-row">
        <label className="field">
          <span className="field-label">{t("track.code")}</span>
          <input className="text-input mono" name="code" required placeholder="T-K7M2QX" maxLength={20} autoCapitalize="characters" />
        </label>
        <label className="field">
          <span className="field-label">{t("form.email")}</span>
          <input className="text-input" name="email" type="email" required maxLength={200} />
        </label>
      </div>
      <div className="tool-actions">
        <button className="btn btn-line" type="submit" disabled={busy}>{busy ? t("common.wait") : t("track.go")}</button>
        {error && <span className="form-msg error" role="alert">{error}</span>}
      </div>
    </form>
  );
}
