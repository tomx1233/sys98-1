// Copies the ffmpeg.wasm files out of node_modules into public/vendor/ffmpeg so the audio converter
// (public/audio.html) can load them from the same origin. Runs on `npm install` (postinstall).
// The files are ~31 MB, so they are generated, not committed (see .gitignore).
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const wrapper = join(root, "node_modules/@ffmpeg/ffmpeg/dist/esm");
const core = join(root, "node_modules/@ffmpeg/core/dist/esm");
const out = join(root, "public/vendor/ffmpeg");

if (!existsSync(wrapper) || !existsSync(core)) {
  console.error("[copy-ffmpeg] @ffmpeg/ffmpeg or @ffmpeg/core is not installed, the audio converter won't work. Run: npm install");
  process.exit(1);
}

mkdirSync(out, { recursive: true });
for (const file of readdirSync(wrapper)) {
  if (file.endsWith(".js")) cpSync(join(wrapper, file), join(out, file));
}
for (const file of ["ffmpeg-core.js", "ffmpeg-core.wasm"]) cpSync(join(core, file), join(out, file));

// gifenc (GIF encoder for the image converter)
const gifenc = join(root, "node_modules/gifenc/dist/gifenc.esm.js");
if (!existsSync(gifenc)) {
  console.error("[copy-ffmpeg] gifenc is not installed, the image converter won't work. Run: npm install");
  process.exit(1);
}
cpSync(gifenc, join(root, "public/vendor/gifenc.esm.js"));
console.log("[copy-ffmpeg] copied ffmpeg.wasm and gifenc to public/vendor");
