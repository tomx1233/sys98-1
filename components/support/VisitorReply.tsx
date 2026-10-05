"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { send } from "@/lib/client";
import { useT } from "@/components/LangProvider";

export function VisitorReply({ token, status }: { token: string; status: string }) {
  const t = useT();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function reply(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError("");
    const res = await send(`/api/support/tickets/${token}/messages`, "POST", { body });
    setBusy(false);
    if (!res.ok) return setError(res.data.error ?? t("common.error"));
    setBody("");
    router.refresh();
  }

  async function solved() {
    setBusy(true);
    setError("");
    const res = await send(`/api/support/tickets/${token}`, "PATCH", { action: "solved" });
    setBusy(false);
    if (!res.ok) return setError(res.data.error ?? t("common.error"));
    router.refresh();
  }

  return (
    <form className="form" onSubmit={reply} style={{ marginTop: 26 }}>
      <label className="field">
        <span className="field-label">{t("ticket.reply")}</span>
        <textarea
          className="tool-textarea"
          rows={5}
          maxLength={4000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") reply(e);
          }}
        />
      </label>
      <div className="tool-actions">
        <button className="btn btn-fill" type="submit" disabled={busy || !body.trim()}>{t("ticket.send")}</button>
        {status !== "resolved" && (
          <button className="btn btn-line" type="button" onClick={solved} disabled={busy}>{t("ticket.solved")}</button>
        )}
        {error && <span className="form-msg error" role="alert">{error}</span>}
      </div>
    </form>
  );
}
