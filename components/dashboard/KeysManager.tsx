"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { send } from "@/lib/client";
import { useT } from "@/components/LangProvider";
import { CopyButton } from "@/components/CopyButton";

export function KeyCreator() {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [keys, setKeys] = useState<string[]>([]);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const exp = String(f.get("expires"));
    setBusy(true);
    setError("");
    const res = await send<{ keys: string[] }>("/api/admin/keys", "POST", {
      label: f.get("label") ?? "",
      maxUses: Number(f.get("maxUses")) || 1,
      expiresInDays: exp === "never" ? null : Number(exp),
      count: Number(f.get("count")) || 1,
    });
    setBusy(false);
    if (!res.ok) return setError(res.data.error ?? t("common.error"));
    setKeys(res.data.keys);
    router.refresh();
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="panel-box">
      <h2 className="h-md">{t("keys.new")}</h2>
      <form className="form" onSubmit={create}>
        <div className="field-row">
          <label className="field">
            <span className="field-label">{t("keys.label")}</span>
            <input className="text-input" name="label" maxLength={60} placeholder={t("keys.labelPh")} />
          </label>
          <label className="field">
            <span className="field-label">{t("keys.expires")}</span>
            <select className="text-input" name="expires" defaultValue="7">
              <option value="1">{t("keys.d1")}</option>
              <option value="7">{t("keys.d7")}</option>
              <option value="30">{t("keys.d30")}</option>
              <option value="never">{t("keys.never")}</option>
            </select>
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span className="field-label">{t("keys.uses")}</span>
            <input className="text-input" name="maxUses" type="number" min={1} max={100} defaultValue={1} />
          </label>
          <label className="field">
            <span className="field-label">{t("keys.count")}</span>
            <input className="text-input" name="count" type="number" min={1} max={20} defaultValue={1} />
          </label>
        </div>
        <div className="tool-actions">
          <button className="btn btn-fill" type="submit" disabled={busy}>{busy ? t("common.wait") : t("keys.generate")}</button>
          {error && <span className="form-msg error" role="alert">{error}</span>}
        </div>
      </form>

      {keys.length > 0 && (
        <div className="keybox" style={{ marginTop: 20 }}>
          <p className="field-hint" style={{ margin: "0 0 12px", color: "var(--ink)" }}>{t("keys.once")}</p>
          {keys.map((k) => (
            <div className="keyline spread" key={k}>
              <span>{k}</span>
              <span className="row-gap">
                <CopyButton text={k} />
                <CopyButton text={`${origin}/join?key=${k}`} className="btn btn-line btn-sm" />
              </span>
            </div>
          ))}
          <p className="field-hint" style={{ marginBottom: 0 }}>{t("keys.copyHint")}</p>
        </div>
      )}
    </div>
  );
}

export function KeyToggle({ id, disabled }: { id: string; disabled: boolean }) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    await send(`/api/admin/keys/${id}`, "PATCH", { disabled: !disabled });
    setBusy(false);
    router.refresh();
  }
  return (
    <button type="button" className="btn btn-line btn-sm" onClick={toggle} disabled={busy}>
      {disabled ? t("keys.enable") : t("keys.disable")}
    </button>
  );
}
