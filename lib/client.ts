"use client";

export interface ApiResult<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  data: T & { error?: string };
}

/** Tiny fetch wrapper for our JSON routes. Never throws — network problems come back as ok:false. */
export async function send<T = Record<string, unknown>>(
  url: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "Network problem — check your connection and try again." } as T & { error?: string } };
  }
}
