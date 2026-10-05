/**
 * Audio analysis for the Discord bot's /analyze: format, duration, bitrate, integrated loudness (LUFS, ITU-R BS.1770-4)
 * and peak, plus a waveform PNG. Same maths as the browser tool at /roblox-audio (checked against ffmpeg's ebur128).
 *
 * Decoding streams the file in small pieces and only keeps a few numbers per 10 ms, so a long song doesn't need much memory.
 * No framework imports on purpose (easy to test on its own).
 */
import zlib from "node:zlib";

export interface Sniffed {
  kind: "mp3" | "vorbis" | "opus" | "flac" | "wav" | "unsupported";
  label: string;
  /** sample rate as written in the file header, if we could read it */
  sampleRate?: number;
}

const ascii = (b: Uint8Array, p: number, n: number) => String.fromCharCode(...b.subarray(p, p + n));
const u32le = (b: Uint8Array, p: number) => (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24)) >>> 0;
const u16le = (b: Uint8Array, p: number) => b[p] | (b[p + 1] << 8);

export function sniffAudio(b: Uint8Array): Sniffed {
  try {
    if (ascii(b, 0, 4) === "OggS") {
      const p = 27 + b[26];
      if (ascii(b, p + 1, 6) === "vorbis") return { kind: "vorbis", label: "OGG (Vorbis)", sampleRate: u32le(b, p + 12) };
      if (ascii(b, p, 8) === "OpusHead") return { kind: "opus", label: "OGG (Opus)", sampleRate: 48000 };
      return { kind: "unsupported", label: "OGG (unknown codec)" };
    }
    if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WAVE") {
      let o = 12;
      while (o + 8 < b.length) {
        const id = ascii(b, o, 4), sz = u32le(b, o + 4);
        if (id === "fmt ") return { kind: "wav", label: "WAV", sampleRate: u32le(b, o + 12) };
        o += 8 + sz + (sz & 1);
      }
      return { kind: "wav", label: "WAV" };
    }
    if (ascii(b, 0, 4) === "fLaC") return { kind: "flac", label: "FLAC", sampleRate: (b[18] << 12) | (b[19] << 4) | (b[20] >> 4) };
    if (ascii(b, 4, 4) === "ftyp") return { kind: "unsupported", label: "M4A / MP4" };
    if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { kind: "unsupported", label: "WebM / MKV" };
    let s = 0;
    if (ascii(b, 0, 3) === "ID3") s = 10 + (((b[6] & 0x7f) << 21) | ((b[7] & 0x7f) << 14) | ((b[8] & 0x7f) << 7) | (b[9] & 0x7f));
    for (let i = s; i < Math.min(b.length - 4, s + 8192); i++) {
      if (b[i] === 0xff && (b[i + 1] & 0xe0) === 0xe0 && ((b[i + 1] >> 1) & 3) === 1) {
        const ver = (b[i + 1] >> 3) & 3, idx = (b[i + 2] >> 2) & 3;
        if (idx === 3 || ver === 1) continue;
        const table = ver === 3 ? [44100, 48000, 32000] : ver === 2 ? [22050, 24000, 16000] : [11025, 12000, 8000];
        return { kind: "mp3", label: "MP3", sampleRate: table[idx] };
      }
    }
  } catch {
    /* fall through */
  }
  return { kind: "unsupported", label: "unknown" };
}

// ---------- the measuring part ----------

interface Biquad { b0: number; b1: number; b2: number; a1: number; a2: number }

function kWeighting(fs: number): [Biquad, Biquad] {
  const f1 = 1681.974450955533, G = 3.999843853973347, Q1 = 0.7071752369554196;
  const K1 = Math.tan((Math.PI * f1) / fs), Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, 0.4996667741545416), d1 = 1 + K1 / Q1 + K1 * K1;
  const s1 = { b0: (Vh + (Vb * K1) / Q1 + K1 * K1) / d1, b1: (2 * (K1 * K1 - Vh)) / d1, b2: (Vh - (Vb * K1) / Q1 + K1 * K1) / d1, a1: (2 * (K1 * K1 - 1)) / d1, a2: (1 - K1 / Q1 + K1 * K1) / d1 };
  const f2 = 38.13547087602444, Q2 = 0.5003270373238773, K2 = Math.tan((Math.PI * f2) / fs), d2 = 1 + K2 / Q2 + K2 * K2;
  const s2 = { b0: 1, b1: -2, b2: 1, a1: (2 * (K2 * K2 - 1)) / d2, a2: (1 - K2 / Q2 + K2 * K2) / d2 };
  return [s1, s2];
}

export interface Analysis {
  format: string;
  sampleRate: number;
  channels: number;
  durationSeconds: number;
  sizeBytes: number;
  bitrateKbps: number;
  /** integrated loudness, null when the file is silent */
  lufs: number | null;
  /** highest sample in dBFS, null when silent */
  peakDb: number | null;
  wave: { min: Float32Array[]; max: Float32Array[]; buckets: number };
}

class Analyzer {
  fs = 0;
  channels = 0;
  total = 0;
  private hop = 0;
  private bucket = 0;
  private energy!: Float64Array;
  private bmin: Float32Array[] = [];
  private bmax: Float32Array[] = [];
  private peak = 0;
  private filt: { p1: number; p2: number; q1: number; q2: number }[] = [];
  private k!: [Biquad, Biquad];
  private maxSamples = 0;

  constructor(private maxSeconds: number) {}

  push(data: Float32Array[], sampleRate: number) {
    const n = data[0]?.length ?? 0;
    if (!n) return;
    if (!this.fs) {
      this.fs = sampleRate;
      this.channels = data.length;
      this.hop = Math.round(sampleRate * 0.1);
      this.bucket = Math.max(1, Math.round(sampleRate * 0.01));
      this.maxSamples = Math.floor(sampleRate * this.maxSeconds);
      this.energy = new Float64Array(Math.ceil(this.maxSeconds * 10) + 8);
      for (let c = 0; c < Math.min(2, data.length); c++) {
        this.bmin.push(new Float32Array(Math.ceil(this.maxSeconds * 100) + 8));
        this.bmax.push(new Float32Array(Math.ceil(this.maxSeconds * 100) + 8));
      }
      this.k = kWeighting(sampleRate);
      this.filt = data.map(() => ({ p1: 0, p2: 0, q1: 0, q2: 0 }));
    }
    if (this.total + n > this.maxSamples) throw new AnalysisError(`That file is longer than ${Math.round(this.maxSeconds / 60)} minutes.`);
    const [s, t] = this.k;
    for (let c = 0; c < data.length; c++) {
      const x = data[c], f = this.filt[c];
      let { p1, p2, q1, q2 } = f, pk = this.peak;
      const mins = c < 2 ? this.bmin[c] : null, maxs = c < 2 ? this.bmax[c] : null;
      for (let i = 0; i < n; i++) {
        const v = x[i], g = this.total + i;
        const a = v < 0 ? -v : v;
        if (a > pk) pk = a;
        const y = s.b0 * v + p1; p1 = s.b1 * v - s.a1 * y + p2; p2 = s.b2 * v - s.a2 * y;
        const z = t.b0 * y + q1; q1 = t.b1 * y - t.a1 * z + q2; q2 = t.b2 * y - t.a2 * z;
        this.energy[(g / this.hop) | 0] += z * z;
        if (mins && maxs) {
          const bi = (g / this.bucket) | 0;
          if (v < mins[bi]) mins[bi] = v;
          if (v > maxs[bi]) maxs[bi] = v;
        }
      }
      f.p1 = p1; f.p2 = p2; f.q1 = q1; f.q2 = q2; this.peak = pk;
    }
    this.total += n;
  }

  finish(): { lufs: number | null; peakDb: number | null; duration: number; wave: Analysis["wave"] } {
    const N = this.total, hop = this.hop, segs = Math.ceil(N / hop);
    const blocks: number[] = [];
    for (let j = 0; (j + 4) * hop <= N; j++) blocks.push((this.energy[j] + this.energy[j + 1] + this.energy[j + 2] + this.energy[j + 3]) / (4 * hop));
    if (!blocks.length) {
      let tot = 0;
      for (let e = 0; e < segs; e++) tot += this.energy[e];
      blocks.push(tot / Math.max(1, N));
    }
    const L = (z: number) => -0.691 + 10 * Math.log10(z);
    let lufs: number | null = null;
    const abs = blocks.filter((z) => L(z) > -70);
    if (abs.length) {
      const mean = abs.reduce((a, b) => a + b, 0) / abs.length, relT = L(mean) - 10;
      const rel = abs.filter((z) => L(z) > relT);
      if (rel.length) lufs = L(rel.reduce((a, b) => a + b, 0) / rel.length);
    }
    const buckets = Math.ceil(N / this.bucket);
    return {
      lufs,
      peakDb: this.peak > 0 ? 20 * Math.log10(this.peak) : null,
      duration: N / this.fs,
      wave: { min: this.bmin.map((a) => a.subarray(0, buckets)), max: this.bmax.map((a) => a.subarray(0, buckets)), buckets },
    };
  }
}

export class AnalysisError extends Error {}

const CHUNK = 64 * 1024;

async function decodeInto(bytes: Uint8Array, sn: Sniffed, an: Analyzer) {
  if (sn.kind === "wav") return decodeWav(bytes, an);
  if (sn.kind === "mp3") {
    const { MPEGDecoder } = await import("mpg123-decoder");
    const d = new MPEGDecoder();
    await d.ready;
    try {
      for (let o = 0; o < bytes.length; o += CHUNK) { const r = d.decode(bytes.subarray(o, o + CHUNK)); an.push(r.channelData.map((c) => c.subarray(0, r.samplesDecoded)), r.sampleRate); }
    } finally { d.free(); }
    return;
  }
  // Vorbis/Opus/FLAC: decode the whole (already-in-memory) file in one call — their streaming decode()
  // needs page-aligned chunks, which byte-offset slicing doesn't guarantee, so decodeFile is the reliable option.
  if (sn.kind === "vorbis") {
    const { OggVorbisDecoder } = await import("@wasm-audio-decoders/ogg-vorbis");
    const d = new OggVorbisDecoder();
    await d.ready;
    try { const r = await d.decodeFile(bytes); an.push(r.channelData.map((c) => c.subarray(0, r.samplesDecoded)), r.sampleRate); } finally { d.free(); }
    return;
  }
  if (sn.kind === "opus") {
    const { OggOpusDecoder } = await import("ogg-opus-decoder");
    const d = new OggOpusDecoder();
    await d.ready;
    try { const r = await d.decodeFile(bytes); an.push(r.channelData.map((c) => c.subarray(0, r.samplesDecoded)), r.sampleRate); } finally { d.free(); }
    return;
  }
  if (sn.kind === "flac") {
    const { FLACDecoder } = await import("@wasm-audio-decoders/flac");
    const d = new FLACDecoder();
    await d.ready;
    try { const r = await d.decodeFile(bytes); an.push(r.channelData.map((c) => c.subarray(0, r.samplesDecoded)), r.sampleRate); } finally { d.free(); }
  }
}

function decodeWav(b: Uint8Array, an: Analyzer) {
  let o = 12, fmt: { tag: number; ch: number; sr: number; bits: number } | null = null, dataAt = -1, dataLen = 0;
  while (o + 8 <= b.length) {
    const id = ascii(b, o, 4); const sz = u32le(b, o + 4);
    if (id === "fmt ") fmt = { tag: u16le(b, o + 8), ch: u16le(b, o + 10), sr: u32le(b, o + 12), bits: u16le(b, o + 22) };
    if (id === "data") { dataAt = o + 8; dataLen = Math.min(sz, b.length - dataAt); break; }
    o += 8 + sz + (sz & 1);
  }
  if (!fmt || dataAt < 0 || fmt.ch < 1) throw new AnalysisError("Couldn't read this WAV file.");
  let tag = fmt.tag;
  if (tag === 0xfffe && b.length >= 0) tag = fmt.bits === 32 ? 1 : 1; // extensible: treat as PCM unless float below
  const bytes = fmt.bits >> 3, frame = bytes * fmt.ch;
  const isFloat = fmt.tag === 3 || (fmt.tag === 0xfffe && fmt.bits === 32 && false);
  if (!(fmt.tag === 1 || fmt.tag === 3 || fmt.tag === 0xfffe) || ![8, 16, 24, 32].includes(fmt.bits)) throw new AnalysisError("This WAV format isn't supported.");
  const frames = Math.floor(dataLen / frame), step = 65536;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  for (let f0 = 0; f0 < frames; f0 += step) {
    const n = Math.min(step, frames - f0), out = Array.from({ length: fmt.ch }, () => new Float32Array(n));
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < fmt.ch; c++) {
        const p = dataAt + (f0 + i) * frame + c * bytes;
        let v: number;
        if (isFloat) v = dv.getFloat32(p, true);
        else if (fmt.bits === 16) v = dv.getInt16(p, true) / 32768;
        else if (fmt.bits === 24) v = ((b[p] | (b[p + 1] << 8) | (b[p + 2] << 16)) << 8 >> 8) / 8388608;
        else if (fmt.bits === 32) v = dv.getInt32(p, true) / 2147483648;
        else v = (b[p] - 128) / 128;
        out[c][i] = v;
      }
    }
    an.push(out, fmt.sr);
  }
}

export async function analyzeAudio(bytes: Uint8Array, opts: { maxSeconds?: number } = {}): Promise<Analysis> {
  const sn = sniffAudio(bytes);
  if (sn.kind === "unsupported") {
    throw new AnalysisError(`I can't read ${sn.label === "unknown" ? "that kind of" : sn.label} files here yet. Send MP3, OGG (Vorbis or Opus), WAV or FLAC.`);
  }
  const an = new Analyzer(opts.maxSeconds ?? 20 * 60);
  try {
    await decodeInto(bytes, sn, an);
  } catch (e) {
    if (e instanceof AnalysisError) throw e;
    throw new AnalysisError("Couldn't decode that file. Is it really audio?");
  }
  if (!an.total) throw new AnalysisError("Couldn't find any audio in that file.");
  const r = an.finish();
  return {
    format: sn.label,
    sampleRate: sn.sampleRate ?? an.fs,
    channels: an.channels,
    durationSeconds: r.duration,
    sizeBytes: bytes.length,
    bitrateKbps: Math.round((bytes.length * 8) / r.duration / 1000),
    lufs: r.lufs,
    peakDb: r.peakDb,
    wave: r.wave,
  };
}

// ---------- waveform picture (a plain PNG, no image library needed) ----------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = (buf: Uint8Array) => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

function pngChunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  Buffer.from(data.buffer, data.byteOffset, data.length).copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

export function encodePng(w: number, h: number, rgb: Uint8Array): Buffer {
  const stride = w * 3, raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(rgb.buffer, rgb.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk("IHDR", ihdr), pngChunk("IDAT", zlib.deflateSync(raw, { level: 6 })), pngChunk("IEND", new Uint8Array(0))]);
}

export function renderWaveformPng(a: Analysis, width = 960): Buffer {
  const rows = Math.min(2, a.wave.min.length), rowH = 96, pad = 8, axis = 22;
  const W = width, H = rows * rowH + pad * 2 + axis;
  const img = new Uint8Array(W * H * 3);
  const put = (x: number, y: number, c: number[]) => { if (x >= 0 && x < W && y >= 0 && y < H) { const p = (y * W + x) * 3; img[p] = c[0]; img[p + 1] = c[1]; img[p + 2] = c[2]; } };
  const BG = [23, 26, 28], LINE = [47, 58, 61], TEAL = [72, 185, 199], TICK = [95, 104, 109];
  for (let i = 0; i < W * H; i++) { img[i * 3] = BG[0]; img[i * 3 + 1] = BG[1]; img[i * 3 + 2] = BG[2]; }
  const B = Math.max(1, a.wave.buckets);
  for (let r = 0; r < rows; r++) {
    const mid = pad + r * rowH + rowH / 2 | 0, half = rowH / 2 - 3;
    for (let x = 0; x < W; x++) put(x, mid, LINE);
    for (let x = 0; x < W; x++) {
      const from = Math.floor((x * B) / W), to = Math.max(from + 1, Math.floor(((x + 1) * B) / W));
      let mn = 0, mx = 0;
      for (let i = from; i < to && i < B; i++) { if (a.wave.min[r][i] < mn) mn = a.wave.min[r][i]; if (a.wave.max[r][i] > mx) mx = a.wave.max[r][i]; }
      const y1 = Math.round(mid - Math.min(1, mx) * half), y2 = Math.round(mid - Math.max(-1, mn) * half);
      for (let y = y1; y <= Math.max(y1, y2); y++) put(x, y, TEAL);
    }
  }
  // time ticks: short every step, taller every 4th
  const steps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600], step = steps.find((s) => a.durationSeconds / s <= 24) ?? 600, ay = pad + rows * rowH + 2;
  for (let t = 0, i = 0; t <= a.durationSeconds; t += step, i++) {
    const x = Math.min(W - 1, Math.round((t / a.durationSeconds) * (W - 1)));
    for (let y = ay; y < ay + (i % 4 === 0 ? 10 : 5); y++) put(x, y, TICK);
  }
  for (let x = 0; x < W; x++) put(x, ay, TICK);
  return encodePng(W, H, img);
}
