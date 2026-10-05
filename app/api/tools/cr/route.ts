import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { processCr, CR_MAX_BYTES } from "@/lib/cr";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export const maxDuration = 60;

// Website twin of the bot's /cr: POST a file + preset, get the shifted MP3 + spectrogram back.
// The finished bytes are kept in memory behind a one-time-ish token and streamed by GET.

interface Stored { mp3: Buffer; spectrogram: Buffer; filename: string; at: number }
const results = new Map<string, Stored>();
const STORE_MS = 15 * 60 * 1000;

function prune() {
  const now = Date.now();
  for (const [k, v] of results) if (now - v.at > STORE_MS) results.delete(k);
  if (results.size > 60) {
    const oldest = [...results.entries()].sort((a, b) => a[1].at - b[1].at);
    for (const [k] of oldest.slice(0, results.size - 60)) results.delete(k);
  }
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limit = rateLimit(`cr:${ip}`, 8, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Slow down a little, try again in a moment." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Send the audio file as a multipart upload." }, { status: 400 });
  }
  const file = form.get("file");
  const preset = String(form.get("preset") ?? "").trim();
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "Attach an audio file first." }, { status: 400 });
  if (file.size > CR_MAX_BYTES) return NextResponse.json({ ok: false, error: "That file is too big (max 20 MB)." }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await processCr(bytes, preset, { userId: ip, auddToken: process.env.AUDD_API_TOKEN });
  if (!result.ok) {
    const status = result.kind === "busy" || result.kind === "cooldown" ? 429 : result.kind === "notoken" ? 503 : 400;
    return NextResponse.json(
      { ok: false, error: result.error, retryAfterSeconds: result.retryAfterSeconds },
      { status, headers: result.retryAfterSeconds ? { "Retry-After": String(result.retryAfterSeconds) } : undefined }
    );
  }

  prune();
  const token = crypto.randomBytes(18).toString("base64url");
  const stem = (file.name || "audio").replace(/\.[^.]+$/, "") || "audio";
  results.set(token, { mp3: result.mp3, spectrogram: result.spectrogram, filename: `${stem}_cr.mp3`, at: Date.now() });
  return NextResponse.json({ ok: true, token, meta: result.meta });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const what = req.nextUrl.searchParams.get("what") === "spectrogram" ? "spectrogram" : "mp3";
  const hit = results.get(token);
  if (!hit) return NextResponse.json({ ok: false, error: "That result expired or never existed. Run the tool again." }, { status: 404 });
  const body = what === "spectrogram" ? hit.spectrogram : hit.mp3;
  const filename = what === "spectrogram" ? "spectrogram.png" : hit.filename;
  const type = what === "spectrogram" ? "image/png" : "audio/mpeg";
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=900",
    },
  });
}
