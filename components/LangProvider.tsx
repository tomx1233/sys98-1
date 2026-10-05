"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { dictionaries, type Key } from "@/lib/i18n";

const STORE = "s98-lang";
const EVENT = "s98-lang-change";
const KNOWN = ["en", "de", "fr", "es", "it", "pt", "nl", "pl", "tr", "ru"];

export type Vars = Record<string, string | number>;

interface Ctx {
  lang: string;
  setLang: (l: string) => void;
  t: (key: Key, vars?: Vars) => string;
}

const LangContext = createContext<Ctx | null>(null);

function readLang(): string {
  try {
    const saved = localStorage.getItem(STORE);
    return saved && KNOWN.includes(saved) ? saved : "en";
  } catch {
    return "en";
  }
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

export function LangProvider({ children }: { children: React.ReactNode }) {
  // same storage key as the static pages (system98.js), so the choice follows you around
  const lang = useSyncExternalStore(subscribe, readLang, () => "en");

  const setLang = useCallback((l: string) => {
    try {
      localStorage.setItem(STORE, l);
    } catch {}
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const t = useCallback(
    (key: Key, vars?: Vars) => {
      const raw = dictionaries[lang]?.[key] ?? dictionaries.en[key];
      if (!vars) return raw;
      return raw.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
    },
    [lang]
  );

  useEffect(() => {
    document.documentElement.setAttribute("lang", lang);
  }, [lang]);

  // the little "opening moment" the static pages have
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add("booted")));
    return () => cancelAnimationFrame(id);
  }, []);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): Ctx {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used inside <LangProvider>");
  return ctx;
}

export function useT() {
  return useLang().t;
}

/** Server components render text through this: <T k="support.title" /> */
export function T({ k, v }: { k: Key; v?: Vars }) {
  return <>{useT()(k, v)}</>;
}
