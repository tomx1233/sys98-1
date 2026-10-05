/** Minimal typings for soundtouchjs (no official types ship with the package). Only what lib/audioShift.ts uses. */
declare module "soundtouchjs" {
  interface SoundTouchBuffer {
    /** push interleaved stereo frames into the pipe */
    putSamples(samples: Float32Array, position?: number, numFrames?: number): void;
  }
  interface SoundTouchOutBuffer {
    /** frames currently available */
    frameCount: number;
    /** pull interleaved stereo frames out of the pipe */
    receiveSamples(out: Float32Array, numFrames?: number): void;
  }
  export class SoundTouch {
    /** playback-rate multiplier (changes pitch and speed together) */
    rate: number;
    /** time-stretch factor, pitch preserved (1 = unchanged) */
    tempo: number;
    /** pitch multiplier, tempo preserved when combined with `tempo` (1 = unchanged) */
    pitch: number;
    readonly inputBuffer: SoundTouchBuffer;
    readonly outputBuffer: SoundTouchOutBuffer;
    process(): void;
    clear(): void;
  }
}
