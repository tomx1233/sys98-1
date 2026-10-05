"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { INCIDENT_SEVERITIES, INCIDENT_STATUSES } from "@/lib/constants";
import { send } from "@/lib/client";
import { useT } from "@/components/LangProvider";

export function IncidentCreator() {
  const t = useT();
  const router = useRouter();
  const [severity, setSeverity] = useState<(typeof INCIDENT_SEVERITIES)[number]>("minor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setError("");
    const res = await send("/api/incidents", "POST", { title: f.get("title"), severity, body: f.get("body") });
    setBusy(false);
    if (!res.ok) return setError(res.data.error ?? t("common.error"));
    form.reset();
    router.refresh();
  }

  return (
    <form className="form panel-box" onSubmit={submit}>
      <h2 className="h-md">{t("inc.new")}</h2>
      <label className="field">
        <span className="field-label">{t("inc.title")}</span>
        <input className="text-input" name="title" required minLength={3} maxLength={120} placeholder={t("inc.titlePh")} />
      </label>
      <div className="field">
        <span className="field-label">{t("inc.severity")}</span>
        <div className="chip-row" role="radiogroup">
          {INCIDENT_SEVERITIES.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={severity === s} className={`chip${severity === s ? " active" : ""}`} onClick={() => setSeverity(s)}>
              {t(`sev.${s}`)}
            </button>
          ))}
        </div>
      </div>
      <label className="field">
        <span className="field-label">{t("inc.body")}</span>
        <textarea className="tool-textarea" name="body" rows={3} required minLength={3} maxLength={2000} />
      </label>
      <div className="tool-actions">
        <button className="btn btn-fill" type="submit" disabled={busy}>{busy ? t("common.wait") : t("inc.post")}</button>
        {error && <span className="form-msg error" role="alert">{error}</span>}
      </div>
    </form>
  );
}

export function IncidentUpdater({ id, status, canDelete }: { id: string; status: string; canDelete: boolean }) {
  const t = useT();
  const router = useRouter();
  const [next, setNext] = useState(status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setError("");
    const res = await send(`/api/incidents/${id}/updates`, "POST", { status: next, body: f.get("body") });
    setBusy(false);
    if (!res.ok) return setError(res.data.error ?? t("common.error"));
    form.reset();
    router.refresh();
  }

  async function remove() {
    if (!window.confirm(t("inc.confirmDelete"))) return;
    setBusy(true);
    const res = await send(`/api/incidents/${id}`, "DELETE");
    setBusy(false);
    if (!res.ok) return setError(res.data.error ?? t("common.error"));
    router.refresh();
  }

  return (
    <form className="form incident-form" onSubmit={submit}>
      <div className="field">
        <span className="field-label">{t("inc.newStatus")}</span>
        <div className="chip-row" role="radiogroup">
          {INCIDENT_STATUSES.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={next === s} className={`chip${next === s ? " active" : ""}`} onClick={() => setNext(s)}>
              {t(`inc.${s}`)}
            </button>
          ))}
        </div>
      </div>
      <label className="field">
        <span className="field-label">{t("inc.updateBody")}</span>
        <textarea className="tool-textarea" name="body" rows={2} required minLength={3} maxLength={2000} />
      </label>
      <div className="tool-actions">
        <button className="btn btn-fill btn-sm" type="submit" disabled={busy}>{t("inc.update")}</button>
        {canDelete && (
          <button className="btn btn-line btn-sm btn-danger" type="button" onClick={remove} disabled={busy}>{t("inc.delete")}</button>
        )}
        {error && <span className="form-msg error" role="alert">{error}</span>}
      </div>
    </form>
  );
}
