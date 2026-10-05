/**
 * Tests for the /analyze and /shazam pipelines: format sniffing, LUFS/peak measurement,
 * waveform PNG rendering, the WASM decoder wiring and the AudD response parsing.
 *
 * Run with: npm test   (or: npx tsx --tsconfig tsconfig.json tests/audio-analysis.test.ts)
 */
import { analyzeAudio, renderWaveformPng, sniffAudio, AnalysisError } from "@/lib/audioAnalysis";
import { recognizeSong } from "@/lib/songRecognition";
import { handleInteraction, type BotDeps } from "@/lib/discordBot";

let failures = 0;
let checks = 0;
const ok = (c: unknown, label: string, extra?: unknown) => {
  checks++;
  if (!c) {
    failures++;
    console.error(`  FAIL: ${label}`, extra !== undefined ? JSON.stringify(extra)?.slice(0, 250) : "");
  }
};

/** 2 s stereo 44.1 kHz WAV of a 440 Hz sine at 50 % amplitude → known loudness. */
function sineWav(): Buffer {
  const sr = 44100, secs = 2, n = sr * secs;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.round(Math.sin((2 * Math.PI * 440 * i) / sr) * 0.5 * 32767);
    buf.writeInt16LE(v, 44 + i * 4);
    buf.writeInt16LE(v, 44 + i * 4 + 2);
  }
  return buf;
}

async function main() {
  // ---------- sniffing ----------
  ok(sniffAudio(sineWav()).kind === "wav", "sniff WAV");
  ok(sniffAudio(Buffer.from("OggS" + "\0".repeat(40))).kind !== "wav", "sniff OGG isn't WAV");
  ok(sniffAudio(Buffer.from("ID3 garbage")).kind === "unsupported", "sniff garbage → unsupported");

  // ---------- analysis of a known signal ----------
  {
    const a = await analyzeAudio(sineWav(), { maxSeconds: 20 * 60 });
    ok(Math.abs(a.durationSeconds - 2) < 0.01, "duration ~2 s", a.durationSeconds);
    ok(a.channels === 2, "stereo detected", a.channels);
    ok(a.sampleRate === 44100, "sample rate from header", a.sampleRate);
    // 0.5-amplitude sine: peak ≈ -6.2 dBFS, K-weighted integrated loudness ≈ -6.9 LUFS
    ok(a.peakDb !== null && Math.abs(a.peakDb + 6.2) < 1, "peak ≈ -6 dBFS", a.peakDb);
    ok(a.lufs !== null && Math.abs(a.lufs + 6.9) < 1.5, "LUFS ≈ -6.9", a.lufs);
    ok(a.bitrateKbps > 0, "bitrate computed", a.bitrateKbps);
    const png = renderWaveformPng(a);
    ok(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), "waveform is a valid PNG");
    ok(png.length > 1000, "waveform has content", png.length);
  }

  // ---------- too-long files are rejected with a friendly error ----------
  {
    let threw = false;
    try {
      await analyzeAudio(sineWav(), { maxSeconds: 1 });
    } catch (e) {
      threw = e instanceof AnalysisError;
    }
    ok(threw, "longer-than-allowed file throws AnalysisError");
  }

  // ---------- unsupported / broken files ----------
  {
    const cases: [string, Buffer][] = [
      ["MP4 container", Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom")])],
      ["garbage with ID3 tag", Buffer.from("ID3" + "\0".repeat(64))],
    ];
    for (const [label, bytes] of cases) {
      let threw = false;
      try {
        await analyzeAudio(bytes, {});
      } catch (e) {
        threw = e instanceof AnalysisError;
      }
      ok(threw, `${label} → friendly AnalysisError`);
    }
  }

  // ---------- WASM decoders load in the Node runtime (same imports /analyze uses) ----------
  {
    const mods: [string, string][] = [
      ["mpg123-decoder", "MPEGDecoder"],
      ["ogg-opus-decoder", "OggOpusDecoder"],
      ["@wasm-audio-decoders/ogg-vorbis", "OggVorbisDecoder"],
      ["@wasm-audio-decoders/flac", "FLACDecoder"],
    ];
    for (const [name, exportName] of mods) {
      try {
        const mod = (await import(name)) as Record<string, new () => { ready: Promise<unknown>; free: () => void }>;
        const Decoder = mod[exportName];
        const d = new Decoder();
        await d.ready;
        d.free();
        ok(true, `${name} instantiates in Node`);
      } catch (e) {
        ok(false, `${name} instantiates in Node`, (e as Error).message);
      }
    }
  }

  // ---------- song recognition parsing (AudD mocked) ----------
  {
    const fakePost = async () => ({
      status: 200,
      json: {
        status: "success",
        result: {
          title: "Test Song", artist: "Test Artist", album: "Album", release_date: "2020", label: "Label",
          song_link: "https://audd.io/song",
          spotify: { external_urls: { spotify: "https://open.spotify.com/track/1" } },
          apple_music: { url: "https://music.apple.com/x", artwork: { url: "https://art/{w}x{h}.jpg" } },
        },
      },
    });
    const r = await recognizeSong({ data: new Uint8Array(10), filename: "x.mp3" }, "token", fakePost);
    ok(r.ok && r.song.title === "Test Song" && r.song.links.length === 2, "recognizeSong parses a match", r);
    ok(!r.ok ? false : r.song.artwork === "https://art/300x300.jpg", "artwork template filled", r.ok ? r.song.artwork : null);

    const noToken = await recognizeSong({ data: new Uint8Array(10), filename: "x.mp3" }, undefined, fakePost);
    ok(!noToken.ok && noToken.error === "notoken", "no token → notoken");
    const noMatch = await recognizeSong({ data: new Uint8Array(10), filename: "x.mp3" }, "t", async () => ({ status: 200, json: { status: "success", result: null } }));
    ok(!noMatch.ok && noMatch.error === "nomatch", "empty result → nomatch");
    const quota = await recognizeSong({ data: new Uint8Array(10), filename: "x.mp3" }, "t", async () => ({ status: 200, json: { status: "error", error: { error_code: 901 } } }));
    ok(!quota.ok && quota.error === "quota", "error 901 → quota");
  }

  // ---------- /analyze + /shazam through the interaction handler ----------
  const edits: { body: unknown; files?: { name: string; contentType: string }[] }[] = [];
  const analyzeFile = async () => {
    const analysis = await analyzeAudio(sineWav(), { maxSeconds: 20 * 60 });
    return { ok: true as const, analysis, waveformPng: renderWaveformPng(analysis) };
  };
  const deps = {
    siteUrl: "https://system98.org",
    lookupAudio: async () => ({ ok: false as const, error: "unavailable" }),
    lookupUser: async () => ({ ok: false as const, error: "unavailable" }),
    analyzeFile,
    recognizeSong: async () => ({ ok: true as const, song: { title: "T", artist: "A", links: [{ name: "Spotify", url: "https://open.spotify.com/track/1" }] } }),
    allow: () => true,
    allowComponent: () => true,
    editOriginal: async (_a: string, _t: string, body: unknown, files?: { name: string; data: Buffer; contentType: string }[]) => {
      edits.push({ body, files: files?.map((f) => ({ name: f.name, contentType: f.contentType })) });
    },
  } as unknown as BotDeps;

  const attachmentBody = (name: string) => ({
    type: 2,
    application_id: "123456789012345678",
    token: "tokentokentokentoken",
    member: { user: { id: "1" } },
    data: {
      name,
      options: [{ name: "file", value: "att1" }],
      resolved: { attachments: { att1: { id: "att1", filename: "tone.wav", size: 1000, url: "https://cdn.discordapp.com/attachments/x/y/z.wav" } } },
    },
  });

  {
    edits.length = 0;
    const h = handleInteraction(attachmentBody("analyze") as never, deps);
    ok((h.response as { type: number }).type === 5, "/analyze defers");
    await h.after?.();
    const body = JSON.stringify(edits[0]?.body);
    ok(/LUFS/.test(body), "/analyze edit shows LUFS", edits[0]?.body);
    ok(body.includes("attachment://waveform.png"), "/analyze embed references the waveform image");
    ok(edits[0]?.files?.[0]?.name === "waveform.png" && edits[0]?.files?.[0]?.contentType === "image/png", "/analyze attaches waveform.png");
  }
  {
    edits.length = 0;
    const h = handleInteraction(attachmentBody("shazam") as never, deps);
    await h.after?.();
    const body = JSON.stringify(edits[0]?.body);
    ok(body.includes("Spotify"), "/shazam edit shows the song + links", edits[0]?.body);
    ok(/"style":5/.test(body), "/shazam has link buttons");
  }

  console.log(`\naudio-analysis: ${checks} checks, ${failures} failure(s)`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error("HARNESS CRASH:", e);
  process.exit(2);
});
