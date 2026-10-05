/**
 * The /cr Auto-Fit search, ported from Killa's Boss Bot `shazam_proof.py`.
 *
 * Same idea as the Python original: try a ladder of uniform pitch/tempo shifts, mildest first, and
 * for each one ask a real song recogniser about several evenly-spread windows of the FINISHED file.
 * The first shift the recogniser can't identify anywhere wins; if nothing clears, the strongest
 * shift is written as a best effort (marked as not guaranteed). Only uniform pitch/tempo shifts are
 * ever used, so the result always sounds like the same song.
 *
 * Differences from the original, by environment rather than by design:
 *  - the recogniser here is AudD (the one this bot's /shazam uses) instead of Shazam-via-SongRec,
 *  - 6 probe windows instead of 8 so a run fits inside serverless time limits,
 *  - probe results come back as clean / matched / inconclusive (network or quota problems count as
 *    inconclusive and escalate, exactly like the Python version never accepts an unverified shift).
 */
import type { PcmAudio } from "./audioShift";

export const UNDETECTABLE_LADDER: [number, number][] = [
  [-0.5, 1.22], // the verified near-identical setting from the original
  [-0.5, 1.25],
  [-0.5, 1.28],
  [-1.0, 1.25],
  [-1.0, 1.3],
];

export const PROBE_CLIP_SECONDS = 12;
export const SPREAD_WINDOWS = 6;

export type ProbeVerdict = { clean: true } | { matched: true } | { inconclusive: true; reason?: string };

/** Recognises one ~12s clip. Injected so tests (and different recognisers) can plug in. */
export type ClipProbe = (clip: PcmAudio) => Promise<ProbeVerdict>;

/** Spread n probe start times evenly across the song, skipping the very start/end. */
export function windowPoints(durationSeconds: number, n = SPREAD_WINDOWS, clip = PROBE_CLIP_SECONDS): number[] {
  if (durationSeconds <= clip) return [0];
  const usable = durationSeconds - clip;
  if (n <= 1) return [Math.round(usable * 0.5 * 10) / 10];
  return Array.from({ length: n }, (_, i) => Math.round((0.05 + 0.9 * (i / (n - 1))) * usable * 10) / 10);
}

export interface AutofitResult {
  pitch: number;
  tempo: number;
  /** true only when every probe window on the finished file came back clean */
  clean: boolean;
  /** per-window verdicts for the applied shift, or null when the ladder never cleared */
  verdicts: ProbeVerdict[] | null;
}

export interface AutofitHooks {
  /** render a candidate: shift the source pcm by (pitch, tempo) */
  shift: (semitones: number, tempo: number) => PcmAudio;
  /** cut a probe window out of a rendered candidate */
  slice: (pcm: PcmAudio, startSeconds: number, lengthSeconds: number) => PcmAudio;
  probe: ClipProbe;
  progress?: (msg: string) => void;
}

/**
 * Closed-loop search. Throws when the recogniser never gave a usable answer at all (so we don't
 * hand out a file we have zero evidence about — same rule as the Python original).
 */
export async function findUndetectable(source: PcmAudio, hooks: AutofitHooks): Promise<AutofitResult> {
  const durationOf = (p: PcmAudio) => (p.channels[0]?.length ?? 0) / p.sampleRate;
  let gotAnswer = false;

  for (const [pitch, tempo] of UNDETECTABLE_LADDER) {
    hooks.progress?.(`testing uniform shift ${pitch >= 0 ? "+" : ""}${pitch.toFixed(1)} st / +${Math.round((tempo - 1) * 100)}%…`);
    const candidate = hooks.shift(pitch, tempo);
    const points = windowPoints(durationOf(candidate));
    const verdicts: ProbeVerdict[] = [];
    for (const t of points) {
      const clip = hooks.slice(candidate, t, PROBE_CLIP_SECONDS);
      verdicts.push(await hooks.probe(clip));
    }
    const definite = verdicts.every((v) => !("inconclusive" in v));
    if (definite) {
      gotAnswer = true;
      if (verdicts.every((v) => "clean" in v)) {
        return { pitch, tempo, clean: true, verdicts };
      }
    }
    // matched somewhere, or inconclusive: escalate — never accept an unverified shift
  }

  if (!gotAnswer) {
    throw new Error(
      "The recogniser never returned a usable answer (rate-limited or unreachable), so no auto-fit result was produced. Try again in a few minutes."
    );
  }
  const [pitch, tempo] = UNDETECTABLE_LADDER[UNDETECTABLE_LADDER.length - 1];
  hooks.progress?.("strongest shift still not fully clean; using it anyway");
  return { pitch, tempo, clean: false, verdicts: null };
}

// ---------- global gate: one auto-fit at a time + a per-user cooldown (like the Discord bot) ----------

export const AUTOFIT_COOLDOWN_SECONDS = 300;

let autofitRunning = false;
const cooldownUntil = new Map<string, number>();

export type AutofitClaim = { ok: true } | { ok: false; error: "busy" | "cooldown"; retryAfterSeconds?: number };

/** Claim the single auto-fit slot for a user. Release with releaseAutofit once the run finishes. */
export function claimAutofit(userId: string): AutofitClaim {
  if (autofitRunning) return { ok: false, error: "busy" };
  const until = cooldownUntil.get(userId) ?? 0;
  const now = Date.now();
  if (now < until) return { ok: false, error: "cooldown", retryAfterSeconds: Math.ceil((until - now) / 1000) };
  autofitRunning = true;
  return { ok: true };
}

export function releaseAutofit(userId: string) {
  autofitRunning = false;
  cooldownUntil.set(userId, Date.now() + AUTOFIT_COOLDOWN_SECONDS * 1000);
  if (cooldownUntil.size > 1000) cooldownUntil.clear();
}
