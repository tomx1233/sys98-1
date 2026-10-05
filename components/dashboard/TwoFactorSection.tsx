"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { send } from "@/lib/client";
import { useT } from "@/components/LangProvider";
import { CopyButton } from "@/components/CopyButton";

type Mode = "idle" | "setup" | "codes" | "disable" | "regen";

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const t = useT();
  return (
    <div className="keybox">
      <p className="field-hint" style={{ margin: "0 0 12px", color: "var(--ink)" }}>{t("tfa.codesOnce")}</p>
      <div className="codes-grid">
        {codes.map((c) => (
          <span className="keyline" key={c}>{c}</span>
        ))}
      </div>
      <div className="actions" style={{ marginTop: 14 }}>
        <CopyButton text={codes.join("\n")} />
        <button type="button" className="btn btn-fill btn-sm" onClick={onDone}>{t("tfa.saved")}</button>
      </div>
    </div>
  );
}

export function TwoFactorSection({ enabled, codesLeft }: { enabled: boolean; codesLeft: number }) {
  const t = useT();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [qr, setQr] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [codes, setCodes] = useState<string[]>([]);

  const reset = () => {
    setMode("idle");
    setError("");
    setQr(null);
  };

  async function start() {
    setBusy(true);
    setError("");
    const res = await send<{ qrDataUrl: string; secret: string }>("/api/account/2fa/setup", "POST");
    setBusy(false);
    if (!res.ok) return setError(res.data.error ?? t("common.error"));
    setQr(res.data);
    setMode("setup");
  }

  async function confirm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    const res = await send<{ recoveryCodes: string[] }>("/api/account/2fa/confirm", "POST", { code: f.get("code") });
    setBusy(false);
    if (!res.ok) return setError(res.data.error ?? t("common.error"));
    setCodes(res.data.recoveryCodes);
    setQr(null);
    setMode("codes");
  }

  async function guarded(e: React.FormEvent<HTMLFormElement>, url: string) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    const res = await send<{ recoveryCodes?: string[] }>(url, "POST", { password: f.get("password"), code: f.get("code") });
    setBusy(false);
    if (!res.ok) return setError(res.data.error ?? t("common.error"));
    if (res.data.recoveryCodes) {
      setCodes(res.data.recoveryCodes);
      setMode("codes");
    } else {
      reset();
      router.refresh();
    }
  }

  const guardFields = (
    <>
      <div className="field-row">
        <label className="field">
          <span className="field-label">{t("auth.password")}</span>
          <input className="text-input" name="password" type="password" required autoComplete="current-password" />
        </label>
        <label className="field">
          <span className="field-label">{t("tfa.code")}</span>
          <input className="text-input mono" name="code" required autoComplete="one-time-code" spellCheck={false} placeholder="123 456" />
        </label>
      </div>
    </>
  );

  return (
    <div className="panel-box">
      <div className="tfa-head">
        <h2 className="h-md" style={{ margin: 0 }}>{t("tfa.title")}</h2>
        <span className={`pill ${enabled || mode === "codes" ? "resolved" : "closed"}`}>{enabled || mode === "codes" ? t("tfa.on") : t("tfa.off")}</span>
      </div>

      {mode === "idle" && !enabled && (
        <>
          <p className="muted-p" style={{ margin: "12px 0 16px" }}>{t("tfa.offLead")}</p>
          <button className="btn btn-fill" type="button" onClick={start} disabled={busy}>{t("tfa.enable")}</button>
        </>
      )}

      {mode === "idle" && enabled && (
        <>
          <p className="muted-p" style={{ margin: "12px 0 16px" }}>{t("tfa.onLead", { n: codesLeft })}</p>
          <div className="row-gap wrap-row">
            <button className="btn btn-line" type="button" onClick={() => setMode("regen")}>{t("tfa.regen")}</button>
            <button className="btn btn-line btn-danger" type="button" onClick={() => setMode("disable")}>{t("tfa.disable")}</button>
          </div>
        </>
      )}

      {mode === "setup" && qr && (
        <form className="form" onSubmit={confirm} style={{ marginTop: 16 }}>
          <p className="muted-p" style={{ margin: 0 }}>{t("tfa.scan")}</p>
          <div className="tfa-qr">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr.qrDataUrl} alt="2FA QR code" width={180} height={180} />
            <div>
              <span className="field-hint" style={{ marginTop: 0 }}>{t("tfa.manual")}</span>
              <div className="keyline" style={{ wordBreak: "break-all", margin: "6px 0 8px" }}>{qr.secret}</div>
              <CopyButton text={qr.secret} />
            </div>
          </div>
          <label className="field" style={{ maxWidth: 260 }}>
            <span className="field-label">{t("tfa.firstCode")}</span>
            <input className="text-input mono" name="code" required autoComplete="one-time-code" inputMode="numeric" maxLength={7} placeholder="123456" autoFocus />
          </label>
          <div className="tool-actions">
            <button className="btn btn-fill" type="submit" disabled={busy}>{busy ? t("common.wait") : t("tfa.activate")}</button>
            <button className="btn btn-line" type="button" onClick={reset}>{t("tfa.cancel")}</button>
          </div>
        </form>
      )}

      {mode === "codes" && (
        <div style={{ marginTop: 16 }}>
          <RecoveryCodes
            codes={codes}
            onDone={() => {
              setCodes([]);
              reset();
              router.refresh();
            }}
          />
        </div>
      )}

      {(mode === "disable" || mode === "regen") && (
        <form className="form" style={{ marginTop: 16 }} onSubmit={(e) => guarded(e, mode === "disable" ? "/api/account/2fa/disable" : "/api/account/2fa/recovery-codes")}>
          <p className="muted-p" style={{ margin: 0 }}>{mode === "disable" ? t("tfa.disableLead") : t("tfa.regenLead")}</p>
          {guardFields}
          <div className="tool-actions">
            <button className={`btn ${mode === "disable" ? "btn-line btn-danger" : "btn-fill"}`} type="submit" disabled={busy}>
              {mode === "disable" ? t("tfa.disable") : t("tfa.regen")}
            </button>
            <button className="btn btn-line" type="button" onClick={reset}>{t("tfa.cancel")}</button>
          </div>
        </form>
      )}

      {error && <p className="form-msg error" role="alert" style={{ margin: "12px 0 0" }}>{error}</p>}
    </div>
  );
}
