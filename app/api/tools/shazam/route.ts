import { NextRequest, NextResponse } from "next/server";
import { recognizeSong } from "@/lib/songRecognition";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export const maxDuration = 30;

// Website twin of the bot's /shazam: upload an audio file, we send it to AudD
// (same token, same endpoint, same error wording as the Discord command).

const MAX_BYTES = 20 * 1024 * 1024;

const MESSAGES: Record<string, string> = {
  notoken: "Song recognition isn't set up (no AudD token). An owner needs to set AUDD_API_TOKEN.",
  nomatch: "Couldn't identify a song in that clip. It needs a clear stretch of music to match.",
  toobig: "That file is too big for recognition (max 20 MB).",
  badfile: "Couldn't read that file. Send a normal audio file with music in it.",
  quota: "The song-recognition quota is used up for now, try again later.",
  unavailable: "The song-recognition service didn't answer, try again in a moment.",
};

export async function POST(req: NextRequest) {
  const limit = rateLimit(`shazam:${clientIp(req)}`, 10, 60_000);
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
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Attach an audio file first." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: MESSAGES.toobig }, { status: 413 });
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const result = await recognizeSong({ data, filename: file.name || "audio" }, process.env.AUDD_API_TOKEN, async (fd) => {
    const res = await fetch("https://api.audd.io/", { method: "POST", body: fd, signal: AbortSignal.timeout(25000) });
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  });

  if (!result.ok) {
    const status = result.error === "quota" ? 429 : result.error === "toobig" || result.error === "badfile" ? 400 : result.error === "nomatch" ? 404 : 502;
    return NextResponse.json({ ok: false, error: MESSAGES[result.error] ?? MESSAGES.unavailable }, { status });
  }
  return NextResponse.json({ ok: true, song: result.song });
}
