"use client";

import { useState } from "react";
import { send } from "@/lib/client";
import { useT } from "@/components/LangProvider";

export function JoinForm({ initialKey }: { initialKey: string }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get("password") !== f.get("password2")) {
      setError(t("auth.mismatch"));
      return;
    }
    setBusy(true);
    setError("");
    const res = await send("/api/auth/join", "POST", {
      key: f.get("key"),
      email: f.get("email"),
      username: f.get("username"),
      password: f.get("password"),
    });
    if (!res.ok) {
      setBusy(false);
      setError(res.data.error ?? t("common.error"));
      return;
    }
    window.location.assign("/dashboard/profile?welcome=1");
  }

  return (
    <form className="sec form" onSubmit={onSubmit} style={{ maxWidth: 520 }}>
      <label className="field">
        <span className="field-label">{t("auth.key")}</span>
        <input
          className="text-input mono"
          name="key"
          required
          defaultValue={initialKey}
          placeholder="S98-XXXXX-XXXXX-XXXXX"
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="characters"
        />
      </label>
      <div className="field-row">
        <label className="field">
          <span className="field-label">{t("auth.username")}</span>
          <input className="text-input" name="username" required minLength={3} maxLength={24} autoComplete="username" />
        </label>
        <label className="field">
          <span className="field-label">{t("form.email")}</span>
          <input className="text-input" name="email" type="email" required autoComplete="email" />
        </label>
      </div>
      <div className="field-row">
        <label className="field">
          <span className="field-label">{t("auth.password")}</span>
          <input className="text-input" name="password" type="password" required minLength={10} maxLength={72} autoComplete="new-password" />
          <span className="field-hint">{t("auth.pwHint")}</span>
        </label>
        <label className="field">
          <span className="field-label">{t("auth.password2")}</span>
          <input className="text-input" name="password2" type="password" required minLength={10} maxLength={72} autoComplete="new-password" />
        </label>
      </div>
      <div className="tool-actions">
        <button className="btn btn-fill" type="submit" disabled={busy}>{busy ? t("common.wait") : t("auth.join")}</button>
        {error && <span className="form-msg error" role="alert">{error}</span>}
      </div>
    </form>
  );
}
