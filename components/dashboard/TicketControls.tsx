"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STATUSES } from "@/lib/constants";
import { send } from "@/lib/client";
import { useT } from "@/components/LangProvider";

export function StatusSwitch({ id, status }: { id: string; status: string }) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function set(next: string) {
    if (next === status) return;
    setBusy(true);
    await send(`/api/tickets/${id}`, "PATCH", { status: next });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="chip-row" role="radiogroup" aria-label={t("dash.setStatus")}>
      {STATUSES.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={status === s}
          disabled={busy}
          className={`chip${status === s ? " active" : ""}`}
          onClick={() => set(s)}
        >
          {t(`status.${s}`)}
        </button>
      ))}
    </div>
  );
}

export function StaffReply({ id, mailOn, visitorName }: { id: string; mailOn: boolean; visitorName: string }) {
  const t = useT();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!body.trim() || busy) return;
    setBusy(true);
    setError("");
    const res = await send(`/api/tickets/${id}/messages`, "POST", { body });
    setBusy(false);
    if (!res.ok) return setError(res.data.error ?? t("common.error"));
    setBody("");
    router.refresh();
  }

  return (
    <form
      className="form"
      style={{ marginTop: 26 }}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label className="field">
        <span className="field-label">{t("dash.replyTo", { name: visitorName })}</span>
        <textarea
          className="tool-textarea"
          rows={6}
          maxLength={4000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
        />
        <span className="field-hint">{mailOn ? t("dash.replyMailOn") : t("dash.replyMailOff")} {t("dash.ctrlEnter")}</span>
      </label>
      <div className="tool-actions">
        <button className="btn btn-fill" type="submit" disabled={busy || !body.trim()}>{t("ticket.send")}</button>
        {error && <span className="form-msg error" role="alert">{error}</span>}
      </div>
    </form>
  );
}
