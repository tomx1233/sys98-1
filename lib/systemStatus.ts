import dns from "node:dns/promises";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { emailEnabled, verifyEmail } from "@/lib/email";

export type ComponentState = "operational" | "degraded" | "down" | "off";
export type ComponentKey = "website" | "support" | "email" | "removebg" | "checker" | "qr" | "discord";

export interface ComponentStatus {
  key: ComponentKey;
  state: ComponentState;
  ms: number | null;
  /** short code for a translated hint (status.d.<detail>) */
  detail?: "slow" | "unreachable" | "notConfigured" | "noCredits" | "authFailed" | "rateLimited" | "error";
}

export interface SystemStatus {
  overall: "operational" | "degraded" | "down";
  components: ComponentStatus[];
  checkedAt: string;
}

const TIMEOUT_MS = 5000;

function withTimeout<T>(p: Promise<T>, ms = TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

async function timed<T>(fn: () => Promise<T>): Promise<{ ok: true; ms: number; value: T } | { ok: false; ms: number; error: unknown }> {
  const started = performance.now();
  try {
    const value = await withTimeout(fn());
    return { ok: true, ms: Math.round(performance.now() - started), value };
  } catch (error) {
    return { ok: false, ms: Math.round(performance.now() - started), error };
  }
}

// ---------- the individual checks. Each one really exercises the thing it names. ----------

async function checkSupport(): Promise<ComponentStatus> {
  const r = await timed(() => prisma.$queryRaw`SELECT 1`);
  if (!r.ok) return { key: "support", state: "down", ms: null, detail: "unreachable" };
  return { key: "support", state: r.ms > 1500 ? "degraded" : "operational", ms: r.ms, detail: r.ms > 1500 ? "slow" : undefined };
}

async function checkEmail(): Promise<ComponentStatus> {
  if (!emailEnabled()) return { key: "email", state: "off", ms: null, detail: "notConfigured" };
  const r = await timed(() => verifyEmail());
  if (!r.ok) return { key: "email", state: "down", ms: null, detail: "unreachable" };
  return { key: "email", state: r.ms > 3000 ? "degraded" : "operational", ms: r.ms, detail: r.ms > 3000 ? "slow" : undefined };
}

async function checkRemoveBg(): Promise<ComponentStatus> {
  const key = process.env.REMOVEBG_API_KEY;
  if (!key) return { key: "removebg", state: "off", ms: null, detail: "notConfigured" };
  // the account endpoint doesn't use up any credits
  const r = await timed(() => fetch("https://api.remove.bg/v1/account", { headers: { "X-Api-Key": key }, cache: "no-store" }));
  if (!r.ok) return { key: "removebg", state: "down", ms: null, detail: "unreachable" };
  const res = r.value;
  if (res.status === 401 || res.status === 403) return { key: "removebg", state: "degraded", ms: r.ms, detail: "authFailed" };
  if (res.status === 429) return { key: "removebg", state: "degraded", ms: r.ms, detail: "rateLimited" };
  if (res.status >= 500) return { key: "removebg", state: "down", ms: r.ms, detail: "error" };
  if (res.ok) {
    try {
      const data = (await res.json()) as { data?: { attributes?: { credits?: { total?: number }; api?: { free_calls?: number } } } };
      const a = data.data?.attributes;
      if (a && a.credits?.total === 0 && a.api?.free_calls === 0) {
        return { key: "removebg", state: "degraded", ms: r.ms, detail: "noCredits" };
      }
    } catch {
      /* answered 200, good enough */
    }
  }
  return { key: "removebg", state: r.ms > 3000 ? "degraded" : "operational", ms: r.ms, detail: r.ms > 3000 ? "slow" : undefined };
}

async function checkChecker(): Promise<ComponentStatus> {
  // the "Is it down?" tool lives on DNS + outbound connections: prove both work
  const r = await timed(() => Promise.any([dns.lookup("cloudflare.com"), dns.lookup("google.com")]));
  if (!r.ok) return { key: "checker", state: "down", ms: null, detail: "unreachable" };
  return { key: "checker", state: r.ms > 2000 ? "degraded" : "operational", ms: r.ms, detail: r.ms > 2000 ? "slow" : undefined };
}

async function checkQr(): Promise<ComponentStatus> {
  const r = await timed(() => QRCode.toString("system98", { type: "svg" }));
  return r.ok ? { key: "qr", state: "operational", ms: r.ms } : { key: "qr", state: "down", ms: null, detail: "error" };
}

async function checkDiscordBot(): Promise<ComponentStatus> {
  // The bot has no gateway/websocket connection (it only answers Discord's HTTP interactions),
  // so there's no real "online" presence to read. This instead proves the bot's own credentials
  // still work by asking Discord's API who they belong to.
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return { key: "discord", state: "off", ms: null, detail: "notConfigured" };
  const r = await timed(() => fetch("https://discord.com/api/v10/users/@me", { headers: { Authorization: `Bot ${token}` }, cache: "no-store" }));
  if (!r.ok) return { key: "discord", state: "down", ms: null, detail: "unreachable" };
  const res = r.value;
  if (res.status === 401) return { key: "discord", state: "down", ms: r.ms, detail: "authFailed" };
  if (res.status === 429) return { key: "discord", state: "degraded", ms: r.ms, detail: "rateLimited" };
  if (!res.ok) return { key: "discord", state: "down", ms: r.ms, detail: "error" };
  return { key: "discord", state: r.ms > 2000 ? "degraded" : "operational", ms: r.ms, detail: r.ms > 2000 ? "slow" : undefined };
}

// ---------- run everything (cached for a moment so a busy page can't hammer SMTP / remove.bg) ----------

const CACHE_MS = 30_000;
const g = globalThis as unknown as { s98Status?: { at: number; promise: Promise<SystemStatus> } };

export function overallOf(components: ComponentStatus[]): SystemStatus["overall"] {
  // "off" (not configured) is not a problem, just not offered
  const live = components.filter((c) => c.state !== "off");
  if (live.some((c) => c.state === "down")) return "down";
  if (live.some((c) => c.state === "degraded")) return "degraded";
  return "operational";
}

async function run(): Promise<SystemStatus> {
  const settled = await Promise.allSettled([checkSupport(), checkEmail(), checkRemoveBg(), checkChecker(), checkQr(), checkDiscordBot()]);
  const keys: ComponentKey[] = ["support", "email", "removebg", "checker", "qr", "discord"];
  const checks = settled.map((s, i): ComponentStatus =>
    s.status === "fulfilled" ? s.value : { key: keys[i], state: "down", ms: null, detail: "error" }
  );
  // if this code runs at all, the website itself is serving
  const components: ComponentStatus[] = [{ key: "website", state: "operational", ms: null }, ...checks];
  return { overall: overallOf(components), components, checkedAt: new Date().toISOString() };
}

export function getSystemStatus(): Promise<SystemStatus> {
  const now = Date.now();
  if (g.s98Status && now - g.s98Status.at < CACHE_MS) return g.s98Status.promise;
  const promise = run();
  g.s98Status = { at: now, promise };
  return promise;
}
