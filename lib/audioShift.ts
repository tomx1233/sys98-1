/**
 * Audio key/speed shifting for the /cr command (ported from Killa's Boss Bot, GPL-3.0 fork of Scope).
 *
 * The Discord original runs ffmpeg (`asetrate` + `aresample` + `atempo`, libmp3lame, showspectrumpic).
 * Vercel/Next has no ffmpeg binary, so this does the same maths in pure JS:
 *
 *   pitch shift + tempo change  ==  SoundTouch with `pitch = 2^(semitones/12)` and `tempo = factor`
 *   (internally: resample -> pitch goes up and audio gets shorter, then a WSOLA time-stretch brings the
 *    duration back to what the tempo factor asks for — exactly what asetrate + atempo do).
 *
 * Decoding reuses the same WASM decoders as /analyze; MP3 encoding is lamejs (192 kbps like the original)
 * and the spectrogram PNG is rendered with the same dependency-free PNG writer as the waveform.
 */
import { SoundTouch } from "soundtouchjs";
import { sniffAudio, encodePng, AnalysisError } from "./audioAnalysis";

export interface PcmAudio {
  sampleRate: number;
  /** one Float32Array (values -1..1) per channel */
  channels: Float32Array[];
}

const CHUNK = 64 * 1024;

/** Decode a whole file to raw PCM. Same formats as /analyze (MP3, OGG Vorbis/Opus, WAV, FLAC). */
export async function decodeToPcm(bytes: Uint8Array): Promise<PcmAudio> {
  const sn = sniffAudio(bytes);
  if (sn.kind === "unsupported") {
    throw new AnalysisError(`I can't read ${sn.label === "unknown" ? "that kind of" : sn.label} files here. Send MP3, OGG (Vorbis or Opus), WAV or FLAC.`);
  }
  try {
    if (sn.kind === "wav") return decodeWavPcm(bytes);
    if (sn.kind === "mp3") {
      const { MPEGDecoder } = await import("mpg123-decoder");
      const d = new MPEGDecoder();
      await d.ready;
      try {
        const parts: Float32Array[][] = [];
        let sr = 44100;
        for (let o = 0; o < bytes.length; o += CHUNK) {
          const r = d.decode(bytes.subarray(o, o + CHUNK));
          if (r.samplesDecoded > 0) { parts.push(r.channelData.map((c) => c.slice(0, r.samplesDecoded))); sr = r.sampleRate; }
        }
        return concat(parts, sr);
      } finally { d.free(); }
    }
    if (sn.kind === "vorbis") {
      const { OggVorbisDecoder } = await import("@wasm-audio-decoders/ogg-vorbis");
      const d = new OggVorbisDecoder();
      await d.ready;
      try { const r = await d.decodeFile(bytes); return { sampleRate: r.sampleRate, channels: r.channelData.map((c) => c.slice(0, r.samplesDecoded)) }; } finally { d.free(); }
    }
    if (sn.kind === "opus") {
      const { OggOpusDecoder } = await import("ogg-opus-decoder");
      const d = new OggOpusDecoder();
      await d.ready;
      try { const r = await d.decodeFile(bytes); return { sampleRate: r.sampleRate, channels: r.channelData.map((c) => c.slice(0, r.samplesDecoded)) }; } finally { d.free(); }
    }
    const { FLACDecoder } = await import("@wasm-audio-decoders/flac");
    const d = new FLACDecoder();
    await d.ready;
    try { const r = await d.decodeFile(bytes); return { sampleRate: r.sampleRate, channels: r.channelData.map((c) => c.slice(0, r.samplesDecoded)) }; } finally { d.free(); }
  } catch (e) {
    if (e instanceof AnalysisError) throw e;
    throw new AnalysisError("Couldn't decode that file. Is it really audio?");
  }
}

function concat(parts: Float32Array[][], sampleRate: number): PcmAudio {
  if (!parts.length) throw new AnalysisError("Couldn't find any audio in that file.");
  const ch = parts[0].length;
  const total = parts.reduce((n, p) => n + p[0].length, 0);
  const channels = Array.from({ length: ch }, () => new Float32Array(total));
  let off = 0;
  for (const p of parts) {
    for (let c = 0; c < ch; c++) channels[c].set(p[c], off);
    off += p[0].length;
  }
  return { sampleRate, channels };
}

const ascii = (b: Uint8Array, p: number, n: number) => String.fromCharCode(...b.subarray(p, p + n));
const u32le = (b: Uint8Array, p: number) => (b[p] | (b[1 + p] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24)) >>> 0;
const u16le = (b: Uint8Array, p: number) => b[p] | (b[p + 1] << 8);

function decodeWavPcm(b: Uint8Array): PcmAudio {
  let o = 12, fmt: { tag: number; ch: number; sr: number; bits: number } | null = null, dataAt = -1, dataLen = 0;
  while (o + 8 <= b.length) {
    const id = ascii(b, o, 4); const sz = u32le(b, o + 4);
    if (id === "fmt ") fmt = { tag: u16le(b, o + 8), ch: u16le(b, o + 10), sr: u32le(b, o + 12), bits: u16le(b, o + 22) };
    if (id === "data") { dataAt = o + 8; dataLen = Math.min(sz, b.length - dataAt); break; }
    o += 8 + sz + (sz & 1);
  }
  if (!fmt || dataAt < 0 || fmt.ch < 1) throw new AnalysisError("Couldn't read this WAV file.");
  if (!(fmt.tag === 1 || fmt.tag === 3) || ![8, 16, 24, 32].includes(fmt.bits)) throw new AnalysisError("This WAV format isn't supported.");
  const bytes = fmt.bits >> 3, frame = bytes * fmt.ch, frames = Math.floor(dataLen / frame);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const channels = Array.from({ length: fmt.ch }, () => new Float32Array(frames));
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < fmt.ch; c++) {
      const p = dataAt + i * frame + c * bytes;
      let v: number;
      if (fmt.tag === 3) v = dv.getFloat32(p, true);
      else if (fmt.bits === 16) v = dv.getInt16(p, true) / 32768;
      else if (fmt.bits === 24) v = ((b[p] | (b[p + 1] << 8) | (b[p + 2] << 16)) << 8 >> 8) / 8388608;
      else if (fmt.bits === 32) v = dv.getInt32(p, true) / 2147483648;
      else v = (b[p] - 128) / 128;
      channels[c][i] = v;
    }
  }
  if (!frames) throw new AnalysisError("Couldn't find any audio in that file.");
  return { sampleRate: fmt.sr, channels };
}

// ---------- the shift itself ----------

/** /cr preset table, identical to the Discord bot's: name -> (pitch semitones, tempo factor). */
export const CR_PRESETS: Record<string, { semi: number; tempo: number }> = {
  subtle: { semi: 1.5, tempo: 1.04 },
  balanced: { semi: 2.0, tempo: 1.07 },
  stealth: { semi: 2.5, tempo: 1.1 },
  aggressive: { semi: 3.0, tempo: 1.12 },
};

/**
 * Shift pitch by `semitones` and change tempo by `tempo` (1.07 = 7% faster), independently.
 * SoundTouch's buffer is stereo-only, so mono is doubled on the way in and halved on the way out;
 * files with more than two channels are downmixed to stereo first.
 */
export function shiftPcm(pcm: PcmAudio, semitones: number, tempo: number): PcmAudio {
  const sr = pcm.sampleRate;
  const n = pcm.channels[0]?.length ?? 0;
  if (!n) throw new AnalysisError("Couldn't find any audio in that file.");
  const frames = n;
  const mixed = pcm.channels.length > 2 ? mixdown(pcm.channels) : null;
  const left = pcm.channels[0];
  const right = pcm.channels.length > 1 ? pcm.channels[1] : left;
  const stereo = mixed ?? new Float32Array(frames * 2);
  if (!mixed) {
    for (let i = 0; i < frames; i++) { stereo[i * 2] = left[i]; stereo[i * 2 + 1] = right[i]; }
  }

  const st = new SoundTouch();
  st.pitch = Math.pow(2, semitones / 12);
  st.tempo = tempo;
  st.inputBuffer.putSamples(stereo, 0, frames);
  st.process();

  const outFrames = st.outputBuffer.frameCount;
  const out = new Float32Array(outFrames * 2);
  st.outputBuffer.receiveSamples(out, outFrames);
  const L = new Float32Array(outFrames), R = new Float32Array(outFrames);
  for (let i = 0; i < outFrames; i++) { L[i] = out[i * 2]; R[i] = out[i * 2 + 1]; }
  const channels = pcm.channels.length === 1 ? [L] : [L, R];
  return { sampleRate: sr, channels };
}

function mixdown(channels: Float32Array[]): Float32Array {
  const n = channels[0].length, out = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (const c of channels) s += c[i];
    const v = s / channels.length;
    out[i * 2] = v; out[i * 2 + 1] = v;
  }
  return out;
}

// ---------- MP3 export (192 kbps, same as the bot) ----------

export async function encodeMp3(pcm: PcmAudio, kbps = 192): Promise<Buffer> {
  // dynamic import on purpose: the package's CJS entry point is an inert IIFE build, while the ESM
  // build has real exports — import() picks the ESM condition from either module system
  const lame = await import("@breezystack/lamejs");
  const ch = Math.min(2, pcm.channels.length);
  const enc = new lame.Mp3Encoder(ch, pcm.sampleRate, kbps);
  const left = toInt16(pcm.channels[0]);
  const right = ch === 2 ? toInt16(pcm.channels[1]) : undefined;
  const parts: Int8Array[] = [];
  const STEP = 1152 * 8;
  for (let o = 0; o < left.length; o += STEP) {
    const l = left.subarray(o, o + STEP);
    const chunk = ch === 2 ? enc.encodeBuffer(l, right!.subarray(o, o + STEP)) : enc.encodeBuffer(l);
    if (chunk.length) parts.push(new Int8Array(chunk));
  }
  const end = enc.flush();
  if (end.length) parts.push(new Int8Array(end));
  return Buffer.concat(parts.map((p) => Buffer.from(p.buffer, p.byteOffset, p.byteLength)));
}

function toInt16(f: Float32Array): Int16Array {
  const out = new Int16Array(f.length);
  for (let i = 0; i < f.length; i++) {
    const v = Math.max(-1, Math.min(1, f[i]));
    out[i] = v < 0 ? Math.round(v * 32768) : Math.round(v * 32767);
  }
  return out;
}

// ---------- spectrogram (the bot renders one next to every /cr result) ----------

/** Small iterative radix-2 FFT, in place (re/im interleaved power-of-two length). */
function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curR = 1, curI = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b] * curR - im[b] * curI, ti = re[b] * curI + im[b] * curR;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
        const nr = curR * wr - curI * wi;
        curI = curR * wi + curI * wr; curR = nr;
      }
    }
  }
}

// matplotlib "plasma" colormap, approximated with five stops
const PLASMA: [number, number, number][] = [[13, 8, 135], [126, 3, 168], [204, 71, 120], [248, 149, 64], [240, 249, 33]];
function plasmaColor(t: number): [number, number, number] {
  const x = Math.max(0, Math.min(1, t)) * (PLASMA.length - 1);
  const i = Math.min(PLASMA.length - 2, Math.floor(x)), f = x - i;
  const a = PLASMA[i], b = PLASMA[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/** Render a spectrogram PNG (1100x280 like the bot's showspectrumpic) from the first channel. */
export function renderSpectrogramPng(pcm: PcmAudio, width = 1100, height = 280): Buffer {
  const x = pcm.channels[0];
  const SIZE = 1024, HALF = SIZE / 2;
  const hop = Math.max(64, Math.floor(x.length / width));
  const cols = Math.max(2, Math.floor((x.length - SIZE) / hop) + 1);
  const win = new Float64Array(SIZE);
  for (let i = 0; i < SIZE; i++) win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (SIZE - 1)));

  // magnitude in dB per (col, bin); only bins up to ~16 kHz carry useful info
  const binMax = Math.min(HALF, Math.ceil((16000 * SIZE) / pcm.sampleRate));
  const mag = new Float32Array(cols * binMax);
  const re = new Float64Array(SIZE), im = new Float64Array(SIZE);
  let peak = -120;
  for (let c = 0; c < cols; c++) {
    const off = c * hop;
    for (let i = 0; i < SIZE; i++) { re[i] = (x[off + i] ?? 0) * win[i]; im[i] = 0; }
    fft(re, im);
    for (let b = 0; b < binMax; b++) {
      const m = Math.sqrt(re[b] * re[b] + im[b] * im[b]) / HALF;
      const db = m > 1e-9 ? 20 * Math.log10(m) : -120;
      mag[c * binMax + b] = db;
      if (db > peak) peak = db;
    }
  }

  const img = new Uint8Array(width * height * 3);
  const floor = peak - 60; // 60 dB of dynamic range, same feel as gain=.5 on the ffmpeg version
  for (let px = 0; px < width; px++) {
    const c = Math.min(cols - 1, Math.floor((px * cols) / width));
    for (let py = 0; py < height; py++) {
      const bin = Math.min(binMax - 1, Math.floor(((height - 1 - py) * binMax) / height)); // high freqs on top
      const db = mag[c * binMax + bin];
      const t = Math.max(0, Math.min(1, (db - floor) / (peak - floor)));
      const [r, g, b2] = plasmaColor(t);
      const p = (py * width + px) * 3;
      img[p] = r; img[p + 1] = g; img[p + 2] = b2;
    }
  }
  return encodePng(width, height, img);
}

