"use client";

import { useState } from "react";
import { ACCENTS } from "@/lib/constants";
import { send } from "@/lib/client";
import { useT } from "@/components/LangProvider";
import { Icon } from "@/components/Icon";
import { ProfileView } from "@/components/staff/ProfileView";

interface Initial {
  username: string;
  role: string;
  joinedAt: string;
  displayName: string;
  title: string;
  bio: string;
  languages: string;
  avatarUrl: string;
  accent: string;
  isPublic: boolean;
  links: { label: string; url: string }[];
}

export function ProfileEditor({ initial }: { initial: Initial }) {
  const t = useT();
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const set = <K extends keyof Initial>(k: K, v: Initial[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setMsg(null);
  };
  const setLink = (i: number, patch: Partial<{ label: string; url: string }>) =>
    set("links", f.links.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const moveLink = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= f.links.length) return;
    const next = [...f.links];
    [next[i], next[j]] = [next[j], next[i]];
    set("links", next);
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await send("/api/profile", "PUT", {
      displayName: f.displayName,
      title: f.title,
      bio: f.bio,
      languages: f.languages,
      avatarUrl: f.avatarUrl,
      accent: f.accent,
      isPublic: f.isPublic,
      links: f.links.filter((l) => l.label.trim() || l.url.trim()),
    });
    setBusy(false);
    setMsg(res.ok ? { ok: true, text: t("profile.saved") } : { ok: false, text: res.data.error ?? t("common.error") });
  }

  return (
    <div className="split">
      <form className="form" onSubmit={save}>
        <div className="field-row">
          <label className="field">
            <span className="field-label">{t("pe.displayName")}</span>
            <input className="text-input" value={f.displayName} maxLength={40} onChange={(e) => set("displayName", e.target.value)} required />
          </label>
          <label className="field">
            <span className="field-label">{t("pe.title")}</span>
            <input className="text-input" value={f.title} maxLength={40} placeholder={t("pe.titlePh")} onChange={(e) => set("title", e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span className="field-label">{t("pe.bio")}</span>
          <textarea className="tool-textarea" rows={4} maxLength={500} value={f.bio} onChange={(e) => set("bio", e.target.value)} />
          <span className="field-hint">{f.bio.length}/500</span>
        </label>
        <div className="field-row">
          <label className="field">
            <span className="field-label">{t("pe.languages")}</span>
            <input className="text-input" value={f.languages} maxLength={40} placeholder="DE, EN" onChange={(e) => set("languages", e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">{t("pe.avatar")}</span>
            <input className="text-input" value={f.avatarUrl} maxLength={300} placeholder="https://…" onChange={(e) => set("avatarUrl", e.target.value)} />
            <span className="field-hint">{t("pe.avatarHint")}</span>
          </label>
        </div>

        <div className="field">
          <span className="field-label">{t("pe.accent")}</span>
          <div className="chip-row">
            {ACCENTS.map((a) => (
              <button key={a} type="button" className={`chip${f.accent === a ? " active" : ""}`} onClick={() => set("accent", a)}>
                <span className="swatch" data-accent={a} /> {t(`accent.${a}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field-label">{t("pe.links")}</span>
          {f.links.map((l, i) => (
            <div className="link-row" key={i}>
              <input className="text-input" value={l.label} maxLength={32} placeholder={t("pe.linkLabel")} onChange={(e) => setLink(i, { label: e.target.value })} aria-label={t("pe.linkLabel")} />
              <input className="text-input" value={l.url} maxLength={300} placeholder="https://…" onChange={(e) => setLink(i, { url: e.target.value })} aria-label="URL" />
              <button type="button" className="tray-btn" onClick={() => moveLink(i, -1)} disabled={i === 0} aria-label="up"><Icon name="up" /></button>
              <button type="button" className="tray-btn" onClick={() => moveLink(i, 1)} disabled={i === f.links.length - 1} aria-label="down"><Icon name="down" /></button>
              <button type="button" className="tray-btn" onClick={() => set("links", f.links.filter((_, j) => j !== i))} aria-label="remove"><Icon name="x" /></button>
            </div>
          ))}
          {f.links.length < 8 && (
            <button type="button" className="btn btn-line btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => set("links", [...f.links, { label: "", url: "" }])}>
              <Icon name="plus" size={14} />&nbsp;{t("pe.addLink")}
            </button>
          )}
        </div>

        <label className="check">
          <input type="checkbox" checked={f.isPublic} onChange={(e) => set("isPublic", e.target.checked)} />
          <span>
            <b>{t("pe.public")}</b>
            <span className="field-hint" style={{ display: "block" }}>{t("pe.publicHint")}</span>
          </span>
        </label>

        <div className="tool-actions">
          <button className="btn btn-fill" type="submit" disabled={busy}>{busy ? t("common.wait") : t("common.save")}</button>
          {msg && <span className={`form-msg ${msg.ok ? "ok" : "error"}`} role="status">{msg.text}</span>}
        </div>
      </form>

      <div className="preview-col">
        <span className="field-label">{t("pe.preview")}</span>
        <div className="win preview-win">
          <ProfileView
            preview
            p={{
              username: f.username,
              role: f.role,
              displayName: f.displayName,
              title: f.title,
              bio: f.bio,
              languages: f.languages,
              avatarUrl: /^https:\/\//.test(f.avatarUrl) ? f.avatarUrl : null,
              accent: f.accent,
              links: f.links.filter((l) => l.label.trim() && /^https?:\/\//.test(l.url)),
              joinedAt: f.joinedAt,
            }}
          />
        </div>
        {!f.isPublic && <p className="field-hint">{t("pe.hiddenNote")}</p>}
      </div>
    </div>
  );
}
