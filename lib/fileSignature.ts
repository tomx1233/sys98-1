// Copied from Eywa.lol's lib/fileSignature.ts, trimmed to the image types the
// background remover accepts. Checks the actual file bytes, not just the
// claimed MIME type — stops someone renaming a script to "photo.png".
export function matchesSignature(buffer: Buffer, mimeType: string): boolean {
  switch (mimeType) {
    case "image/png":
      return Array.from(buffer.subarray(0, 8)).join(",") ===
        [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].join(",");
    case "image/jpeg":
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case "image/webp":
      return (
        buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
        buffer.subarray(8, 12).toString("ascii") === "WEBP"
      );
    default:
      return false;
  }
}
