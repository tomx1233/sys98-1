import { NextRequest, NextResponse } from "next/server";
import { matchesSignature } from "@/lib/fileSignature";
import { checkFileSize, MAX_IMAGE_SIZE } from "@/lib/uploadLimits";
import { rateLimit, clientIp } from "@/lib/rateLimit";

// Actually removing a background needs a trained segmentation model — that's
// not something to reimplement here. This calls remove.bg's API. Get a key at
// https://www.remove.bg/api (free tier: 50 images/month) and set REMOVEBG_API_KEY.
// Swap the fetch below for a different provider if you'd rather use one.

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limit = rateLimit(`removebg:${ip}`, 10, 60 * 1000); // 10/min per IP
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests, slow down" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  if (!process.env.REMOVEBG_API_KEY) {
    return NextResponse.json({ error: "Background removal is not configured yet" }, { status: 503 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("image");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Use a PNG, JPEG, or WebP image" }, { status: 400 });
  }

  const sizeCheck = checkFileSize(file.size, MAX_IMAGE_SIZE);
  if (!sizeCheck.ok) {
    return NextResponse.json({ error: sizeCheck.message }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!matchesSignature(buffer, file.type)) {
    return NextResponse.json({ error: "That file doesn't match its claimed type" }, { status: 400 });
  }

  const upstreamForm = new FormData();
  upstreamForm.append("image_file", new Blob([buffer], { type: file.type }), "image");
  upstreamForm.append("size", "auto");

  try {
    const res = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": process.env.REMOVEBG_API_KEY! },
      body: upstreamForm,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("remove.bg error", res.status, detail);
      return NextResponse.json({ error: "Background removal failed" }, { status: 502 });
    }
    const resultBuffer = Buffer.from(await res.arrayBuffer());
    return new NextResponse(resultBuffer, { headers: { "Content-Type": "image/png" } });
  } catch (error) {
    console.error("remove.bg request failed", error);
    return NextResponse.json({ error: "Background removal failed" }, { status: 500 });
  }
}
