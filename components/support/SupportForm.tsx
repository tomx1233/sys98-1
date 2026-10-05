"use client";

import { useState } from "react";
import Link from "next/link";
import { CATEGORIES } from "@/lib/constants";
import { send } from "@/lib/client";
import { useLang } from "@/components/LangProvider";
import { CopyButton } from "@/components/CopyButton";

interface Created {
  code: string;
  path: string;
  emailed: boolean;
}

export function SupportForm() {
  const { t, lang } = useLang();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("bug");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Created | null>(null);
  const [sentTo, setSentTo] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    const email = String(f.get("email") ?? "");
    const res = await send<Created>("/api/support/tickets", "POST", {
      name: f.get("name"),
      email,
      category,
      subject: f.get("subject"),
      message: f.get("message"),
      website: f.get("website"),
      lang,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.data.error ?? t("common.error"));
      return;
    }
    setSentTo(email);
    setCreated(res.data);
  }

  if (created) {
    const full = typeof window !== "undefined" ? window.location.origin + created.path : created.path;
    return (
      <div className="sec">
        <span className="eyebrow-mono">{t("form.done.eyebrow")}</span>
        <h2 className="h-lg">{t("form.done.title", { code: created.code })}</h2>
        <p className="muted-p">{t("form.done.body")}</p>
        <div className="keybox" style={{ marginTop: 18 }}>
          <div className="keyline" style={{ wordBreak: "break-all" }}>{full}</div>
          <div className="actions" style={{ marginTop: 12 }}>
            <CopyButton text={full} />
          </div>
        </div>
        <p className="field-hint" style={{ marginTop: 12 }}>
          {created.emailed ? t("form.done.emailed", { email: sentTo }) : t("form.done.noEmail")}
        </p>
        <div className="actions">
          <Link className="btn btn-fill" href={created.path}>{t("form.done.open")}</Link>
          <button className="btn btn-line" type="button" onClick={() => setCreated(null)}>{t("form.done.another")}</button>
        </div>
      </div>
    );
  }

  return (
    <form className="sec form" onSubmit={onSubmit}>
      <div className="field-row">
        <label className="field">
          <span className="field-label">{t("form.name")}</span>
          <input className="text-input" name="name" required maxLength={60} autoComplete="name" />
        </label>
        <label className="field">
          <span className="field-label">{t("form.email")}</span>
          <input className="text-input" name="email" type="email" required maxLength={200} autoComplete="email" />
          <span className="field-hint">{t("form.emailHint")}</span>
        </label>
      </div>

      <div className="field">
        <span className="field-label">{t("form.category")}</span>
        <div className="chip-row" role="radiogroup" aria-label={t("form.category")}>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={category === c}
              className={`chip${category === c ? " active" : ""}`}
              onClick={() => setCategory(c)}
            >
              {t(`cat.${c}`)}
            </button>
          ))}
        </div>
      </div>

      <label className="field">
        <span className="field-label">{t("form.subject")}</span>
        <input className="text-input" name="subject" required minLength={3} maxLength={120} />
      </label>

      <label className="field">
        <span className="field-label">{t("form.message")}</span>
        <textarea className="tool-textarea" name="message" rows={7} required minLength={10} maxLength={4000} placeholder={t("form.messagePh")} />
      </label>

      {/* honeypot: humans never see or fill this */}
      <input className="hp" type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />

      <div className="tool-actions">
        <button className="btn btn-fill" type="submit" disabled={busy}>
          {busy ? t("form.sending") : t("form.send")}
        </button>
        {error && <span className="form-msg error" role="alert">{error}</span>}
      </div>
    </form>
  );
}
