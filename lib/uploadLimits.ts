// Simplified from Eywa.lol's lib/uploadLimits.ts — no premium tiers,
// one flat limit since system98 has no accounts.
export const MAX_IMAGE_SIZE = 8 * 1024 * 1024; // 8MB

export function formatMB(bytes: number): string {
  return `${Math.floor(bytes / (1024 * 1024))}MB`;
}

export function checkFileSize(size: number, maxBytes: number): { ok: true } | { ok: false; message: string } {
  if (size > maxBytes) {
    return { ok: false, message: `That file is ${formatMB(size)} — the max size is ${formatMB(maxBytes)}.` };
  }
  return { ok: true };
}
