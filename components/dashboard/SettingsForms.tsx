"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { send } from "@/lib/client";
import { useT } from "@/components/LangProvider";

type Msg = { ok: boolean; text: string } | null;

export function SettingsForms({ username, email }: { username: string; email: string }) {
  const t = useT();
  const router = useRouter();
  const [accMsg, setAccMsg] = useState<Msg>(null);
  const [pwMsg, setPwMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  async function saveAccount(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const res = await send("/api/account", "PATCH", {
      username: f.get("username"),
      email: f.get("email"),
      currentPassword: f.get("currentPassword") || undefined,
    });
    setBusy(false);
    setAccMsg(res.ok ? { ok: true, text: t("profile.saved") } : { ok: false, text: res.data.error ?? t("common.error") });
    if (res.ok) router.refresh();
  }

  async function savePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    if (f.get("newPassword") !== f.get("newPassword2")) return setPwMsg({ ok: false, text: t("auth.mismatch") });
    setBusy(true);
    const res = await send("/api/account/password", "POST", {
      currentPassword: f.get("currentPassword"),
      newPassword: f.get("newPassword"),
    });
    setBusy(false);
    setPwMsg(res.ok ? { ok: true, text: t("set.pwChanged") } : { ok: false, text: res.data.error ?? t("common.error") });
    if (res.ok) form.reset();
  }

  return (
    <div className="stack-sm">
      <form className="form panel-box" onSubmit={saveAccount}>
        <h2 className="h-md">{t("set.account")}</h2>
        <div className="field-row">
          <label className="field">
            <span className="field-label">{t("auth.username")}</span>
            <input className="text-input" name="username" defaultValue={username} required minLength={3} maxLength={24} />
          </label>
          <label className="field">
            <span className="field-label">{t("form.email")}</span>
            <input className="text-input" name="email" type="email" defaultValue={email} required />
          </label>
        </div>
        <label className="field" style={{ maxWidth: 320 }}>
          <span className="field-label">{t("set.currentPw")}</span>
          <input className="text-input" name="currentPassword" type="password" autoComplete="current-password" />
          <span className="field-hint">{t("set.emailNeedsPw")}</span>
        </label>
        <div className="tool-actions">
          <button className="btn btn-fill" type="submit" disabled={busy}>{t("common.save")}</button>
          {accMsg && <span className={`form-msg ${accMsg.ok ? "ok" : "error"}`} role="status">{accMsg.text}</span>}
        </div>
      </form>

      <form className="form panel-box" onSubmit={savePassword}>
        <h2 className="h-md">{t("set.password")}</h2>
        <label className="field" style={{ maxWidth: 320 }}>
          <span className="field-label">{t("set.currentPw")}</span>
          <input className="text-input" name="currentPassword" type="password" required autoComplete="current-password" />
        </label>
        <div className="field-row">
          <label className="field">
            <span className="field-label">{t("set.newPw")}</span>
            <input className="text-input" name="newPassword" type="password" required minLength={10} maxLength={72} autoComplete="new-password" />
            <span className="field-hint">{t("auth.pwHint")}</span>
          </label>
          <label className="field">
            <span className="field-label">{t("auth.password2")}</span>
            <input className="text-input" name="newPassword2" type="password" required minLength={10} maxLength={72} autoComplete="new-password" />
          </label>
        </div>
        <div className="tool-actions">
          <button className="btn btn-fill" type="submit" disabled={busy}>{t("set.changePw")}</button>
          {pwMsg && <span className={`form-msg ${pwMsg.ok ? "ok" : "error"}`} role="status">{pwMsg.text}</span>}
        </div>
      </form>
    </div>
  );
}
