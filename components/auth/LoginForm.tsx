"use client";

import { useState } from "react";
import { send } from "@/lib/client";
import { useT } from "@/components/LangProvider";

export function LoginForm({ next }: { next: string }) {
  const t = useT();
  const [step, setStep] = useState<"password" | "code">("password");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    const res = await send<{ requiresTwoFactor?: boolean }>("/api/auth/login", "POST", {
      identifier: f.get("identifier"),
      password: f.get("password"),
    });
    setBusy(false);
    if (!res.ok) return setError(res.data.error ?? t("common.error"));
    if (res.data.requiresTwoFactor) return setStep("code");
    // full navigation, so the layout re-reads the new session cookie
    window.location.assign(next);
  }

  async function onCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    const res = await send("/api/auth/2fa/verify", "POST", { code: f.get("code") });
    if (!res.ok) {
      setBusy(false);
      return setError(res.data.error ?? t("common.error"));
    }
    window.location.assign(next);
  }

  async function back() {
    await send("/api/auth/2fa/cancel", "POST");
    setError("");
    setStep("password");
  }

  if (step === "code") {
    return (
      <form className="sec form" onSubmit={onCode} style={{ maxWidth: 460 }}>
        <p className="muted-p" style={{ marginTop: 0 }}>{t("tfa.loginLead")}</p>
        <label className="field">
          <span className="field-label">{t("tfa.code")}</span>
          <input
            className="text-input mono"
            name="code"
            required
            autoFocus
            autoComplete="one-time-code"
            inputMode="text"
            placeholder="123 456"
            spellCheck={false}
          />
          <span className="field-hint">{t("tfa.codeHint")}</span>
        </label>
        <div className="tool-actions">
          <button className="btn btn-fill" type="submit" disabled={busy}>{busy ? t("common.wait") : t("tfa.verify")}</button>
          <button className="btn btn-line" type="button" onClick={back}>{t("tfa.back")}</button>
          {error && <span className="form-msg error" role="alert">{error}</span>}
        </div>
      </form>
    );
  }

  return (
    <form className="sec form" onSubmit={onPassword} style={{ maxWidth: 460 }}>
      <label className="field">
        <span className="field-label">{t("auth.identifier")}</span>
        <input className="text-input" name="identifier" required autoComplete="username" autoFocus />
      </label>
      <label className="field">
        <span className="field-label">{t("auth.password")}</span>
        <input className="text-input" name="password" type="password" required autoComplete="current-password" />
      </label>
      <div className="tool-actions">
        <button className="btn btn-fill" type="submit" disabled={busy}>{busy ? t("common.wait") : t("auth.login")}</button>
        {error && <span className="form-msg error" role="alert">{error}</span>}
      </div>
    </form>
  );
}
