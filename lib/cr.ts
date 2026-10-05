/**
 * The /cr engine shared by the Discord bot and the website tool: applies a key/speed shift preset to
 * an audio file, or runs the Auto-Fit search. Ported from Killa's Boss Bot (/cr, GPL-3.0 Scope fork).
 *
 * Output mirrors the Discord original: a 192 kbps MP3 of the shifted audio plus a spectrogram PNG.
 */
import { CR_PRESETS, decodeToPcm, encodeMp3, renderSpectrogramPng, shiftPcm, type PcmAudio } from "./audioShift";
import { AnalysisError } from "./audioAnalysis";
import { claimAutofit, findUndetectable, releaseAutofit, type ProbeVerdict } from "./crAutofit";
import { recognizeSong, type AudDPost } from "./songRecognition";

export const CR_MAX_BYTES = 20 * 1024 * 1024;
const MAX_PRESET_SECONDS = 10 * 60;
const MAX_AUTOFIT_SECONDS = 8 * 60;

export interface CrMeta {
  preset: string;
  pitch: number;
  tempo: number;
  /** auto-fit only: whether every probe window came back unrecognised */
  clean?: boolean;
  /** auto-fit only: strongest-shift fallback, not verified clean */
  bestEffort?: boolean;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  format: string;
}

export type CrResult =
  | { ok: true; mp3: Buffer; spectrogram: Buffer; meta: CrMeta }
  | { ok: false; error: string; kind?: "busy" | "cooldown" | "notoken"; retryAfterSeconds?: number };

export async function processCr(
  bytes: Uint8Array,
  preset: string,
  opts: { userId?: string; auddToken?: string; auddPost?: AudDPost } = {}
): Promise<CrResult> {
  const isAutofit = preset === "autofit";
  if (!isAutofit && !CR_PRESETS[preset]) {
    return { ok: false, error: `Unknown preset "${preset}". Pick one of: ${Object.keys(CR_PRESETS).join(", ")}, or autofit.` };
  }
  if (bytes.length > CR_MAX_BYTES) return { ok: false, error: "That file is too big (max 20 MB)." };

  let pcm: PcmAudio;
  try {
    pcm = await decodeToPcm(bytes);
  } catch (e) {
    return { ok: false, error: e instanceof AnalysisError ? e.message : "Couldn't decode that file. Is it really audio?" };
  }
  const duration = (pcm.channels[0]?.length ?? 0) / pcm.sampleRate;
  const cap = isAutofit ? MAX_AUTOFIT_SECONDS : MAX_PRESET_SECONDS;
  if (duration > cap) {
    return { ok: false, error: `That file is too long for ${isAutofit ? "auto-fit" : "a preset"} (max ${cap / 60} minutes).` };
  }

  try {
    if (!isAutofit) {
      const { semi, tempo } = CR_PRESETS[preset];
      const shifted = shiftPcm(pcm, semi, tempo);
      return finish(shifted, { preset, pitch: semi, tempo }, pcm);
    }
    return await runAutofit(pcm, opts);
  } catch (e) {
    if (e instanceof AnalysisError) return { ok: false, error: e.message };
    console.error("[cr] processing failed:", e);
    return { ok: false, error: "Processing that file failed. Try a different one." };
  }
}

async function finish(shifted: PcmAudio, head: Pick<CrMeta, "preset" | "pitch" | "tempo"> & Partial<Pick<CrMeta, "clean" | "bestEffort">>, source: PcmAudio): Promise<CrResult> {
  const mp3 = await encodeMp3(shifted);
  const spectrogram = renderSpectrogramPng(shifted);
  return {
    ok: true,
    mp3,
    spectrogram,
    meta: {
      ...head,
      durationSeconds: (shifted.channels[0]?.length ?? 0) / shifted.sampleRate,
      sampleRate: shifted.sampleRate,
      channels: shifted.channels.length,
      format: `${source.sampleRate} Hz source`,
    },
  };
}

async function runAutofit(source: PcmAudio, opts: { userId?: string; auddToken?: string; auddPost?: AudDPost }): Promise<CrResult> {
  if (!opts.auddToken) {
    return { ok: false, error: "Auto-fit isn't set up (no AudD token). An owner needs to set AUDD_API_TOKEN.", kind: "notoken" };
  }
  const userId = opts.userId ?? "anonymous";
  const claim = claimAutofit(userId);
  if (!claim.ok) {
    return claim.error === "busy"
      ? { ok: false, error: "An auto-fit is already testing a file right now. Wait for it to finish, then try again.", kind: "busy" }
      : { ok: false, error: `Auto-fit is on cooldown. Try again in ${claim.retryAfterSeconds} second${claim.retryAfterSeconds === 1 ? "" : "s"}.`, kind: "cooldown", retryAfterSeconds: claim.retryAfterSeconds };
  }

  try {
    const probe = makeAudDProbe(opts.auddToken, opts.auddPost);
    const result = await findUndetectable(source, {
      shift: (semitones, tempo) => shiftPcm(source, semitones, tempo),
      slice: (p, startSeconds, lengthSeconds) => slicePcm(p, startSeconds, lengthSeconds),
      probe,
    });
    const shifted = shiftPcm(source, result.pitch, result.tempo);
    return finish(shifted, { preset: "autofit", pitch: result.pitch, tempo: result.tempo, clean: result.clean, bestEffort: result.verdicts === null }, source);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "The auto-fit failed. Try again in a moment." };
  } finally {
    releaseAutofit(userId);
  }
}

/** Cut a window out of a rendered candidate for the recogniser probe. */
export function slicePcm(pcm: PcmAudio, startSeconds: number, lengthSeconds: number): PcmAudio {
  const from = Math.max(0, Math.floor(startSeconds * pcm.sampleRate));
  const to = Math.min(pcm.channels[0].length, from + Math.ceil(lengthSeconds * pcm.sampleRate));
  return { sampleRate: pcm.sampleRate, channels: pcm.channels.map((c) => c.slice(from, to)) };
}

/** A probe clip as 16-bit WAV (lossless and universally readable by the recogniser). */
export function encodeWav(pcm: PcmAudio): Buffer {
  const ch = Math.min(2, pcm.channels.length), n = pcm.channels[0].length;
  const dataLen = n * ch * 2, out = Buffer.alloc(44 + dataLen);
  out.write("RIFF", 0); out.writeUInt32LE(36 + dataLen, 4); out.write("WAVE", 8);
  out.write("fmt ", 12); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(ch, 22);
  out.writeUInt32LE(pcm.sampleRate, 24); out.writeUInt32LE(pcm.sampleRate * ch * 2, 28);
  out.writeUInt16LE(ch * 2, 32); out.writeUInt16LE(16, 34);
  out.write("data", 36); out.writeUInt32LE(dataLen, 40);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, pcm.channels[c][i]));
      out.writeInt16LE(v < 0 ? Math.round(v * 32768) : Math.round(v * 32767), o);
      o += 2;
    }
  }
  return out;
}

const defaultAudDPost: AudDPost = async (form) => {
  const res = await fetch("https://api.audd.io/", { method: "POST", body: form, signal: AbortSignal.timeout(25000) });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
};

/** Ask AudD about one probe clip: matched / clean / inconclusive (never treat errors as clean). */
export function makeAudDProbe(token: string, post: AudDPost = defaultAudDPost): (clip: PcmAudio) => Promise<ProbeVerdict> {
  return async (clip) => {
    try {
      const r = await recognizeSong({ data: new Uint8Array(encodeWav(clip)), filename: "probe.wav" }, token, post);
      if (r.ok) return { matched: true };
      if (r.error === "nomatch") return { clean: true };
      return { inconclusive: true, reason: r.error };
    } catch {
      return { inconclusive: true, reason: "network" };
    }
  };
}
