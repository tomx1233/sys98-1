import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/rateLimit";
import { fail, limited, parseBody } from "@/lib/api";

// Visitor marks their own ticket as solved.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const blocked = limited(`ticket-patch:${clientIp(req)}`, 30, 10 * 60 * 1000);
  if (blocked) return blocked;

  const { error } = await parseBody(req, z.object({ action: z.literal("solved") }));
  if (error) return error;

  const ticket = await prisma.supportTicket.findUnique({ where: { accessToken: token } });
  if (!ticket) return fail("Not found", 404);
  if (ticket.status === "closed") return fail("This ticket is already closed.", 409);

  await prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: "resolved" } });
  return NextResponse.json({ ok: true });
}
