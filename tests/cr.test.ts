/**
 * Offline tests for the /cr engine (key/speed shift, ported from Killa's Boss Bot):
 * decoding, the pitch/tempo shift maths, MP3 + spectrogram output, the auto-fit ladder
 * and the one-run-at-a-time gate. Run with: npm test (or npx tsx --tsconfig tsconfig.json tests/cr.test.ts).
 */
import { decodeToPcm, shiftPcm, encodeMp3, renderSpectrogramPng, CR_PRESETS, type PcmAudio } from "@/lib/audioShift";
import { processCr, slicePcm, encodeWav } from "@/lib/cr";
import {
  findUndetectable, windowPoints, claimAutofit, releaseAutofit, UNDETECTABLE_LADDER,
  type ProbeVerdict,
} from "@/lib/crAutofit";

let checks = 0, failures = 0;
function ok(cond: boolean, name: string, extra?: unknown) {
  checks++;
  if (!cond) { failures++; console.log(`FAIL ${name}`, extra ?? ""); }
}

async function main() {
  // ---------- synthetic input: a 16-bit PCM WAV holding a 440 Hz sine ----------
  function sineWav(seconds: number, sr = 44100, freq = 440, amp = 0.5): Buffer {
    const n = Math.floor(seconds * sr), out = Buffer.alloc(44 + n * 2);
    out.write("RIFF", 0); out.writeUInt32LE(36 + n * 2, 4); out.write("WAVE", 8);
    out.write("fmt ", 12); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(1, 22);
    out.writeUInt32LE(sr, 24); out.writeUInt32LE(sr * 2, 28); out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34);
    out.write("data", 36); out.writeUInt32LE(n * 2, 40);
    for (let i = 0; i < n; i++) out.writeInt16LE(Math.round(Math.sin((2 * Math.PI * freq * i) / sr) * amp * 32767), 44 + i * 2);
    return out;
  }

  function freqOf(x: Float32Array, sr: number): number {
    // zero-crossing rate on the middle second
    const s = Math.max(1, Math.floor(x.length / 2 - sr / 2)), e = Math.min(x.length, s + sr);
    let zc = 0;
    for (let i = s + 1; i < e; i++) if ((x[i - 1] < 0) !== (x[i] < 0)) zc++;
    return zc / 2 / ((e - s) / sr);
  }

  // ---------- decode ----------
  const wav = sineWav(3);
  const pcm = await decodeToPcm(wav);
  ok(pcm.sampleRate === 44100, "decode: sample rate", pcm.sampleRate);
  ok(pcm.channels.length === 1 && Math.abs(pcm.channels[0].length - 3 * 44100) <= 2, "decode: length", pcm.channels[0]?.length);
  ok(Math.abs(freqOf(pcm.channels[0], pcm.sampleRate) - 440) < 2, "decode: source freq ~440Hz", freqOf(pcm.channels[0], pcm.sampleRate));

  try { await decodeToPcm(new Uint8Array([1, 2, 3, 4])); ok(false, "decode: garbage rejected"); }
  catch (e) { ok(String(e).includes("can't read"), "decode: garbage rejected", String(e)); }

  // ---------- the shift itself: +2 semitones, tempo 1.07x (the ffmpeg maths, verified) ----------
  const pf = Math.pow(2, 2 / 12);
  const shifted = shiftPcm(pcm, 2, 1.07);
  const expectedLen = (3 * 44100) / 1.07;
  ok(Math.abs(shifted.channels[0].length - expectedLen) / expectedLen < 0.05, "shift: duration = original/tempo", { got: shifted.channels[0].length, want: expectedLen });
  const f = freqOf(shifted.channels[0], shifted.sampleRate);
  ok(Math.abs(f - 440 * pf) < 3, "shift: pitch up by 2^(2/12)", { got: f.toFixed(1), want: (440 * pf).toFixed(1) });
  ok(shifted.sampleRate === pcm.sampleRate, "shift: sample rate unchanged");

  // stereo input stays stereo
  const stereo: PcmAudio = { sampleRate: 44100, channels: [pcm.channels[0], pcm.channels[0].map((v) => -v)] };
  const st2 = shiftPcm(stereo, -0.5, 1.22);
  ok(st2.channels.length === 2, "shift: stereo stays stereo", st2.channels.length);

  // ---------- outputs ----------
  const mp3 = await encodeMp3(shifted);
  ok(mp3[0] === 0xff && (mp3[1] & 0xe0) === 0xe0, "mp3: frame sync header", [mp3[0]?.toString(16), mp3[1]?.toString(16)]);
  ok(mp3.length > 10000, "mp3: non-trivial size", mp3.length);

  const png = renderSpectrogramPng(shifted);
  ok(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), "spectrogram: PNG magic");
  const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
  ok(w === 1100 && h === 280, "spectrogram: 1100x280 like the bot", { w, h });
  ok(png.length > 1000, "spectrogram: non-trivial size", png.length);

  const wavOut = encodeWav(shifted);
  ok(wavOut.toString("ascii", 0, 4) === "RIFF" && wavOut.toString("ascii", 8, 12) === "WAVE", "encodeWav: header");

  // ---------- the auto-fit ladder (fake recogniser, no network) ----------
  const clean: ProbeVerdict = { clean: true };
  const matched: ProbeVerdict = { matched: true };
  const inconclusive: ProbeVerdict = { inconclusive: true };
  const hooks = (verdictsPerRung: ProbeVerdict[][], seen: { pitch: number; tempo: number }[]) => ({
    shift: (semitones: number, tempo: number) => { seen.push({ pitch: semitones, tempo }); return shifted; },
    slice: (p: PcmAudio) => slicePcm(p, 0, 1),
    probe: async () => {
      const rung = seen.length - 1;
      const list = verdictsPerRung[Math.min(rung, verdictsPerRung.length - 1)];
      return list[(probeCount[rung] = (probeCount[rung] ?? -1) + 1) % list.length];
    },
  });
  const probeCount: Record<number, number> = {};

  {
    const seen: { pitch: number; tempo: number }[] = [];
    const r = await findUndetectable(pcm, hooks([[clean]], seen));
    ok(r.clean === true && r.pitch === UNDETECTABLE_LADDER[0][0] && r.tempo === UNDETECTABLE_LADDER[0][1], "autofit: clean on rung 0 accepted", r);
    ok(seen.length === 1, "autofit: stops after the winning rung", seen.length);
  }
  {
    const seen: { pitch: number; tempo: number }[] = [];
    const r = await findUndetectable(pcm, hooks([[matched], [matched, clean], [clean]], seen));
    ok(r.clean === true && r.pitch === UNDETECTABLE_LADDER[2][0] && r.tempo === UNDETECTABLE_LADDER[2][1], "autofit: escalates past matched rungs", r);
    ok(seen.length === 3, "autofit: tried three rungs", seen.length);
  }
  {
    const seen: { pitch: number; tempo: number }[] = [];
    const r = await findUndetectable(pcm, hooks([[matched]], seen));
    ok(r.clean === false && r.verdicts === null && seen.length === UNDETECTABLE_LADDER.length, "autofit: best-effort fallback to strongest shift", r);
    ok(r.pitch === UNDETECTABLE_LADDER[UNDETECTABLE_LADDER.length - 1][0] && r.tempo === UNDETECTABLE_LADDER[UNDETECTABLE_LADDER.length - 1][1], "autofit: fallback is the strongest rung", r);
  }
  {
    const seen: { pitch: number; tempo: number }[] = [];
    let threw = false;
    try { await findUndetectable(pcm, hooks([[inconclusive]], seen)); } catch { threw = true; }
    ok(threw, "autofit: never answers when the recogniser never did");
  }
  {
    const pts = windowPoints(200);
    ok(pts.length === 6 && pts[0] > 0 && pts[pts.length - 1] < 200 - 12, "autofit: probe windows spread inside the file", pts);
    ok(windowPoints(5).length === 1 && windowPoints(5)[0] === 0, "autofit: short file -> single window");
  }

  // ---------- the one-run-at-a-time gate ----------
  {
    ok(claimAutofit("user-a").ok === true, "gate: first claim ok");
    const busy = claimAutofit("user-b");
    ok(busy.ok === false && busy.error === "busy", "gate: second claim is busy", busy);
    releaseAutofit("user-a");
    const cool = claimAutofit("user-a");
    ok(cool.ok === false && cool.error === "cooldown" && (cool.retryAfterSeconds ?? 0) > 0, "gate: cooldown after a run", cool);
    ok(claimAutofit("user-b").ok === true, "gate: another user may run");
    releaseAutofit("user-b");
  }

  // ---------- processCr end-to-end (preset path, fully offline) ----------
  {
    const r = await processCr(wav, "balanced");
    ok(r.ok === true, "processCr: balanced ok", r.ok ? "" : r);
    if (r.ok) {
      ok(r.meta.pitch === CR_PRESETS.balanced.semi && r.meta.tempo === CR_PRESETS.balanced.tempo, "processCr: meta matches preset", r.meta);
      ok(Math.abs(r.meta.durationSeconds - 3 / 1.07) < 0.2, "processCr: duration scaled", r.meta.durationSeconds);
      ok(r.mp3[0] === 0xff, "processCr: returns an mp3");
      ok(r.spectrogram.subarray(0, 4).equals(Buffer.from([137, 80, 78, 71])), "processCr: returns a spectrogram png");
    }
    const bad = await processCr(wav, "nope");
    ok(bad.ok === false && /unknown preset/i.test(bad.error), "processCr: unknown preset rejected", bad);
    const huge = await processCr(new Uint8Array(100), "balanced");
    ok(huge.ok === false, "processCr: garbage file rejected", huge);
    const noToken = await processCr(wav, "autofit");
    ok(noToken.ok === false && noToken.kind === "notoken", "processCr: autofit without AudD token", noToken);
  }

  console.log(`\ncr: ${checks} checks, ${failures} failure(s)`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
