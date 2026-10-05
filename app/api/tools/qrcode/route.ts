import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import QRCode from "qrcode"; // npm i qrcode @types/qrcode
import { rateLimit, clientIp } from "@/lib/rateLimit";

const schema = z.object({
  text: z.string().trim().min(1).max(2000),
  format: z.enum(["png", "svg"]).default("png"),
});

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limit = rateLimit(`qrcode:${ip}`, 30, 60 * 1000); // 30/min per IP
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests, slow down" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    if (parsed.data.format === "svg") {
      const svg = await QRCode.toString(parsed.data.text, { type: "svg", margin: 1 });
      return new NextResponse(svg, { headers: { "Content-Type": "image/svg+xml" } });
    }
    const buffer = await QRCode.toBuffer(parsed.data.text, { type: "png", margin: 1, width: 512 });
    return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": "image/png" } });
  } catch (error) {
    console.error("QR generation failed", error);
    return NextResponse.json({ error: "Could not generate QR code" }, { status: 500 });
  }
}
