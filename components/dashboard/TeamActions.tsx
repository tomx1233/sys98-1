"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { send } from "@/lib/client";
import { useT } from "@/components/LangProvider";
import { CopyButton } from "@/components/CopyButton";

export function TeamActions({ id, username, role, disabled, isMe, twoFactor }: { id: string; username: string; role: string; disabled: boolean; isMe: boolean; twoFactor: boolean }) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [temp, setTemp] = useState("");

  async function patch(body: { disabled?: boolean; role?: string }, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError("");
    const res = await send(`/api/admin/staff/${id}`, "PATCH", body);
    setBusy(false);
    if (!res.ok) return setError(res.data.error ?? t("common.error"));
    router.refresh();
  }

  async function reset() {
    if (!window.confirm(t("team.confirmReset", { name: username }))) return;
    setBusy(true);
    setError("");
    const res = await send<{ password: string }>(`/api/admin/staff/${id}/reset-password`, "POST");
    setBusy(false);
    if (!res.ok) return setError(res.data.error ?? t("common.error"));
    setTemp(res.data.password);
  }

  async function reset2fa() {
    if (!window.confirm(t("team.confirmReset2fa", { name: username }))) return;
    setBusy(true);
    setError("");
    const res = await send(`/api/admin/staff/${id}/reset-2fa`, "POST");
    setBusy(false);
    if (!res.ok) return setError(res.data.error ?? t("common.error"));
    router.refresh();
  }

  return (
    <div>
      <div className="row-gap wrap-row">
        {!isMe && (
          <>
            <button type="button" className="btn btn-line btn-sm" disabled={busy} onClick={() => patch({ disabled: !disabled })}>
              {disabled ? t("team.enable") : t("team.disable")}
            </button>
            <button
              type="button"
              className="btn btn-line btn-sm"
              disabled={busy}
              onClick={() => patch({ role: role === "owner" ? "staff" : "owner" }, role === "owner" ? undefined : t("team.confirmOwner", { name: username }))}
            >
              {role === "owner" ? t("team.makeStaff") : t("team.makeOwner")}
            </button>
            <button type="button" className="btn btn-line btn-sm" disabled={busy} onClick={reset}>{t("team.reset")}</button>
            {twoFactor && (
              <button type="button" className="btn btn-line btn-sm" disabled={busy} onClick={reset2fa}>{t("team.reset2fa")}</button>
            )}
          </>
        )}
        {isMe && <span className="muted">{t("team.you")}</span>}
      </div>
      {error && <p className="form-msg error" style={{ margin: "8px 0 0" }}>{error}</p>}
      {temp && (
        <div className="keybox" style={{ marginTop: 10 }}>
          <div className="keyline spread">
            <span>{temp}</span>
            <CopyButton text={temp} />
          </div>
          <p className="field-hint" style={{ margin: "8px 0 0" }}>{t("team.tempNote")}</p>
        </div>
      )}
    </div>
  );
}
