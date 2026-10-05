"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useLang } from "@/components/LangProvider";

const LANGS: [string, string][] = [
  ["en", "English"], ["de", "Deutsch"], ["fr", "Français"], ["es", "Español"], ["it", "Italiano"],
  ["pt", "Português"], ["nl", "Nederlands"], ["pl", "Polski"], ["tr", "Türkçe"], ["ru", "Русский"],
];

export interface Me {
  username: string;
  role: string;
}

function toggleTheme() {
  const root = document.documentElement;
  const current = root.getAttribute("data-theme");
  const isDark = current ? current === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  const next = isDark ? "light" : "dark";
  root.setAttribute("data-theme", next);
  try {
    localStorage.setItem("s98-theme", next);
  } catch {}
}

export function Panelbar({ me }: { me: Me | null }) {
  const { lang, setLang, t } = useLang();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="panelbar">
      <div className="panelbar-inner wrap">
        <a className="brand" href="/">
          <span className="brand-mark">
            <svg viewBox="12 15 40 34" fill="none" aria-hidden="true">
              <rect x="12" y="15" width="40" height="34" rx="6" fill="#15272B" />
              <path d="M12 25h40" stroke="#48B9C7" strokeOpacity=".45" strokeWidth="2" />
              <circle cx="18.5" cy="20" r="2" fill="#FFA71D" />
              <path d="M21 32l6 5.5-6 5.5" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          system98
        </a>

        <a className="panel-link" href="/#tools">{t("nav.tools")}</a>
        <a className="panel-link" href="/#about">{t("nav.about")}</a>
        <Link className="panel-link" href="/support">{t("nav.support")}</Link>
        {me && <Link className="panel-link" href="/dashboard">{t("nav.dashboard")}</Link>}

        <span className="panel-spacer" />

        <div className="tray">
          <div className={`lang-wrap${open ? " open" : ""}`} ref={wrapRef}>
            <button
              type="button"
              className="tray-btn"
              aria-haspopup="listbox"
              aria-expanded={open}
              aria-label="choose language / Sprache wählen"
              onClick={() => setOpen((o) => !o)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" />
              </svg>
              <span style={{ fontFamily: "var(--mono)", fontWeight: 500 }}>{lang.toUpperCase()}</span>
            </button>
            <ul className="lang-list" role="listbox" aria-label="choose language / Sprache wählen">
              {LANGS.map(([code, name]) => (
                <li
                  key={code}
                  role="option"
                  aria-selected={code === lang}
                  className={`lang-option${code === lang ? " active" : ""}`}
                  onClick={() => {
                    setLang(code);
                    setOpen(false);
                  }}
                >
                  <span>{name}</span>
                  <span className="lang-code">{code.toUpperCase()}</span>
                </li>
              ))}
            </ul>
          </div>
          <button id="themeToggle" className="tray-btn" type="button" aria-label="Toggle theme" onClick={toggleTheme}>
            <svg className="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.5 12h2M19.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
            <svg className="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round">
              <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}


export function Statusbar({ me }: { me: Me | null }) {
  const { t } = useLang();
  // the server doesn't know the visitor's timezone, so the clock only exists on the client
  const clock = useSyncExternalStore(
    (cb) => {
      const id = setInterval(cb, 20000);
      return () => clearInterval(id);
    },
    () => {
      const d = new Date();
      return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    },
    () => ""
  );

  return (
    <div className="statusbar">
      <div className="statusbar-inner wrap">
        <span className="seg">
          {me ? (
            <>
              <span className="status-dot" />
              {t("bar.signedIn", { name: me.username })}
            </>
          ) : (
            t("bar.idle")
          )}
        </span>
        <span className="seg" aria-hidden="true">{clock}</span>
        {/* filled in by /presence.js (same script the static pages use) */}
        <span className="seg" id="onlineNow" hidden suppressHydrationWarning />
        <span className="sep" />
        {me ? (
          <Link className="seg" href="/dashboard">{t("nav.dashboard")}</Link>
        ) : (
          <Link className="seg" href="/login">{t("bar.staff")}</Link>
        )}
        <Link className="seg" href="/status">Status</Link>
        <a className="seg" href="/terms">{t("bar.terms")}</a>
        <a className="seg" href="/privacy">{t("bar.privacy")}</a>
        <span className="seg">© 2026 system98</span>
      </div>
    </div>
  );
}
