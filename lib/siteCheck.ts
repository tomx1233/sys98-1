import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";

/**
 * "Is this website up?" — the server fetches a URL the visitor typed in, which is the classic
 * SSRF setup. So every step is deliberately paranoid:
 *  - only http/https, only the default ports (no port scanning), no user:pass@ in the URL
 *  - the hostname is resolved by us, every address must be public, and the connection is pinned
 *    to that exact address (no second DNS lookup an attacker could swap: "DNS rebinding")
 *  - redirects are followed by hand and each hop goes through the same checks
 *  - one HEAD (or GET) request, no body is ever read
 */

export type SiteState = "up" | "reachable" | "down";

export interface SiteResult {
  ok: true;
  state: SiteState;
  host: string;
  finalUrl: string;
  status: number | null;
  ms: number | null;
  redirects: number;
  note: string;
}

export interface SiteError {
  ok: false;
  error: string;
}

export interface ProbeOptions {
  /** per request, ms */
  timeoutMs?: number;
  /** total budget for the whole check incl. redirects, ms */
  deadlineMs?: number;
  /** tests only. The API route never sets this. */
  isBlockedIp?: (ip: string) => boolean;
}

const MAX_REDIRECTS = 5;
const UA = "system98-status/1.0 (+https://system98.org/checker)";

// ---------- IP filtering ----------

const blocked = new net.BlockList();
for (const [net4, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16],
  ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(net4, prefix, "ipv4");
}
for (const [net6, prefix] of [
  ["::", 96], ["64:ff9b::", 96], ["64:ff9b:1::", 48], ["100::", 64],
  ["2001::", 32], ["2001:db8::", 32], ["2002::", 16], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
] as const) {
  blocked.addSubnet(net6, prefix, "ipv6");
}

export function isBlockedAddress(ip: string): boolean {
  const kind = net.isIP(ip);
  if (kind === 4) return blocked.check(ip, "ipv4");
  if (kind === 6) {
    // IPv4 hidden inside IPv6 (::ffff:127.0.0.1 / ::ffff:7f00:1): never a real website, always refuse.
    // (Not a BlockList rule on purpose: Node would then match every plain IPv4 address against it.)
    if (ip.toLowerCase().startsWith("::ffff:")) return true;
    return blocked.check(ip, "ipv6");
  }
  return true;
}

// ---------- URL handling ----------

export class CheckError extends Error {}

export function parseTarget(raw: string): { url: URL; hadScheme: boolean } {
  let input = raw.trim();
  if (!input) throw new CheckError("Enter a website first.");
  if (input.length > 300) throw new CheckError("That address is too long.");
  const hadScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(input);
  if (!hadScheme) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(input) && !/^[^/]*:\d+(\/|$)/.test(input)) {
      throw new CheckError("Only http:// and https:// addresses can be checked.");
    }
    input = "https://" + input;
  }
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new CheckError("That doesn't look like a website address.");
  }
  assertAllowedUrl(url);
  return { url, hadScheme };
}

function assertAllowedUrl(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new CheckError("Only http:// and https:// addresses can be checked.");
  }
  if (url.username || url.password) throw new CheckError("Addresses with a login (user:pass@) aren't supported.");
  if (url.port && url.port !== (url.protocol === "https:" ? "443" : "80")) {
    throw new CheckError("Only the standard ports (80 and 443) can be checked.");
  }
  if (!url.hostname) throw new CheckError("That doesn't look like a website address.");
}

async function resolvePublic(hostname: string, isBlockedIp: (ip: string) => boolean): Promise<{ address: string; family: 4 | 6 }> {
  const bare = hostname.replace(/^\[|\]$/g, "");
  const literal = net.isIP(bare);
  let addrs: { address: string; family: number }[];
  if (literal) {
    addrs = [{ address: bare, family: literal }];
  } else {
    try {
      addrs = await dns.lookup(bare, { all: true, verbatim: true });
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      throw new NetError(code === "ENOTFOUND" || code === "ENODATA" ? "dns" : "dns-other", "The domain doesn't resolve (DNS lookup failed).");
    }
  }
  if (addrs.length === 0) throw new NetError("dns", "The domain doesn't resolve (DNS lookup failed).");
  // one private address in the mix is enough to refuse: we can't know which one a redirect would hit
  if (addrs.some((a) => isBlockedIp(a.address))) {
    throw new CheckError("That address points to a private or internal network, so it can't be checked.");
  }
  const pick = addrs.find((a) => a.family === 4) ?? addrs[0];
  return { address: pick.address, family: pick.family === 6 ? 6 : 4 };
}

// ---------- one request ----------

class NetError extends Error {
  constructor(public kind: string, message: string) {
    super(message);
  }
}

function describeNetError(e: NodeJS.ErrnoException): NetError {
  const code = e.code ?? "";
  if (e.message === "timeout") return new NetError("timeout", "No answer in time — the server didn't respond.");
  if (code === "ECONNREFUSED") return new NetError("refused", "Connection refused — nothing is listening there.");
  if (code === "ECONNRESET" || code === "EPIPE" || /socket hang up/i.test(e.message)) return new NetError("reset", "The server dropped the connection.");
  if (code === "EHOSTUNREACH" || code === "ENETUNREACH") return new NetError("unreach", "The server can't be reached (no route).");
  if (code === "ETIMEDOUT") return new NetError("timeout", "No answer in time — the server didn't respond.");
  if (/CERT|SELF_SIGNED|UNABLE_TO_VERIFY|HOSTNAME_MISMATCH|ERR_TLS/i.test(code) || /certificate|tls|ssl/i.test(e.message)) {
    const why = /expired/i.test(code + e.message) ? "expired" : /hostname|altname/i.test(code + e.message) ? "wrong name" : "invalid";
    return new NetError("tls", `TLS certificate problem (${why}). The server answers, but browsers would warn.`);
  }
  return new NetError("other", "Couldn't connect to the server.");
}

function once(
  url: URL,
  target: { address: string; family: 4 | 6 },
  method: "HEAD" | "GET",
  timeoutMs: number
): Promise<{ status: number; location?: string; ms: number }> {
  return new Promise((resolve, reject) => {
    const isHttps = url.protocol === "https:";
    const started = performance.now();
    const isIpHost = net.isIP(url.hostname.replace(/^\[|\]$/g, "")) !== 0;
    const req = (isHttps ? https : http).request(
      {
        host: url.hostname.replace(/^\[|\]$/g, ""),
        port: isHttps ? 443 : 80,
        path: url.pathname + url.search,
        method,
        agent: false,
        headers: { "User-Agent": UA, Accept: "*/*", Connection: "close" },
        ...(isHttps && !isIpHost ? { servername: url.hostname } : {}),
        // pin the connection to the address we already validated
        lookup: ((_h: string, opts: { all?: boolean }, cb: (...a: unknown[]) => void) => {
          if (opts && opts.all) cb(null, [{ address: target.address, family: target.family }]);
          else cb(null, target.address, target.family);
        }) as never,
      },
      (res) => {
        const ms = Math.round(performance.now() - started);
        const location = typeof res.headers.location === "string" ? res.headers.location : undefined;
        res.destroy(); // headers are all we want, never download the body
        clearTimeout(timer);
        resolve({ status: res.statusCode ?? 0, location, ms });
      }
    );
    const timer = setTimeout(() => req.destroy(new Error("timeout")), timeoutMs);
    req.on("error", (e) => {
      clearTimeout(timer);
      reject(describeNetError(e as NodeJS.ErrnoException));
    });
    req.end();
  });
}

// ---------- the check ----------

export async function probe(raw: string, options: ProbeOptions = {}): Promise<SiteResult | SiteError> {
  const timeoutMs = options.timeoutMs ?? 6000;
  const deadline = Date.now() + (options.deadlineMs ?? 12000);
  const isBlockedIp = options.isBlockedIp ?? isBlockedAddress;

  let parsed: { url: URL; hadScheme: boolean };
  try {
    parsed = parseTarget(raw);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  let url = parsed.url;
  let redirects = 0;
  const startHost = url.hostname;
  let triedHttpFallback = false;

  try {
    for (;;) {
      if (Date.now() > deadline) throw new NetError("timeout", "The check took too long (too many slow hops).");
      assertAllowedUrl(url);
      const target = await resolvePublic(url.hostname, isBlockedIp);

      let hop;
      try {
        hop = await once(url, target, "HEAD", timeoutMs);
        // plenty of servers answer HEAD badly (405, 403, 404…): ask again with GET before judging
        if (hop.status >= 400) {
          try {
            hop = await once(url, target, "GET", timeoutMs);
          } catch {
            /* keep the HEAD answer */
          }
        }
      } catch (e) {
        if (e instanceof NetError && e.kind === "reset") {
          hop = await once(url, target, "GET", timeoutMs); // some servers just hang up on HEAD
        } else if (e instanceof NetError && (e.kind === "refused" || e.kind === "other") && !parsed.hadScheme && !triedHttpFallback && url.protocol === "https:" && redirects === 0) {
          // typed "example.com" without a scheme and https isn't offered: try plain http once
          triedHttpFallback = true;
          url = new URL(url.toString().replace(/^https:/, "http:"));
          continue;
        } else {
          throw e;
        }
      }

      if (hop.status >= 300 && hop.status < 400 && hop.location) {
        if (redirects >= MAX_REDIRECTS) {
          return result("down", url, startHost, hop.status, hop.ms, redirects, "Too many redirects (possible redirect loop).");
        }
        try {
          url = new URL(hop.location, url);
        } catch {
          return result("down", url, startHost, hop.status, hop.ms, redirects, "The server sent an invalid redirect.");
        }
        redirects++;
        continue;
      }

      return classify(url, startHost, hop.status, hop.ms, redirects);
    }
  } catch (e) {
    if (e instanceof CheckError) return { ok: false, error: e.message };
    if (e instanceof NetError) {
      return result("down", url, startHost, null, null, redirects, e.message);
    }
    return result("down", url, startHost, null, null, redirects, "Couldn't connect to the server.");
  }
}

function classify(url: URL, host: string, status: number, ms: number, redirects: number): SiteResult {
  if (status >= 500) {
    const note = status === 503 ? "The server answered 503: it's up but overloaded or in maintenance." : `The server answered with an error (${status}).`;
    return result("down", url, host, status, ms, redirects, note);
  }
  if (status >= 400) {
    const note =
      status === 403 || status === 429 || status === 401
        ? `The server answered, but refuses automated checks (${status}). The site is most likely fine.`
        : `The server answered, but this page returned ${status}.`;
    return result("reachable", url, host, status, ms, redirects, note);
  }
  const slow = ms > 3000 ? " It's slow to respond, though." : "";
  return result("up", url, host, status, ms, redirects, `All good, the server answered normally.${slow}`);
}

function result(state: SiteState, url: URL, host: string, status: number | null, ms: number | null, redirects: number, note: string): SiteResult {
  return { ok: true, state, host, finalUrl: url.toString(), status, ms, redirects, note };
}
