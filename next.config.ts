import type { NextConfig } from "next";

const pages = [
  "remove-bg",
  "qrcode",
  "checker",
  "audio",
  "image",
  "roblox-audio",
  "roblox-user",
  "roblox-group",
  "roblox-game",
  "roblox-avatar",
  "roblox-friends",
  "roblox-accountage",
  "roblox-username",
  "roblox-catalog",
  "roblox-usergroups",
  "roblox-asseticon",
  "shazam",
  "devex",
  "text-tools",
  "crypto",
  "terms",
  "privacy",
];

const nextConfig: NextConfig = {
  // These audio-decoder packages (used by the Discord bot's /analyze) contain an optional Web Worker
  // variant with a dynamic `import(mod)` that Turbopack can't resolve statically. Keeping them external
  // means Node resolves and runs them normally at request time instead of bundling them.
  serverExternalPackages: [
    "mpg123-decoder",
    "ogg-opus-decoder",
    "@wasm-audio-decoders/ogg-vorbis",
    "@wasm-audio-decoders/flac",
    "@wasm-audio-decoders/common",
    "@eshaz/web-worker",
  ],
  async redirects() {
    return [
      { source: "/index.html", destination: "/", permanent: true },
      { source: "/discord", destination: "https://discord.gg/geterror", permanent: false },
      ...pages.map((p) => ({
        source: `/${p}.html`,
        destination: `/${p}`,
        permanent: true,
      })),
    ];
  },
  async headers() {
    return [
      {
        // ffmpeg.wasm for the audio converter (~31 MB): let browsers keep it for a week
        source: "/vendor/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800" }],
      },
    ];
  },
  async rewrites() {
    return [
      { source: "/", destination: "/index.html" },
      ...pages.map((p) => ({
        source: `/${p}`,
        destination: `/${p}.html`,
      })),
    ];
  },
};

export default nextConfig;
