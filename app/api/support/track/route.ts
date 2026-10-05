import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/rateLimit";
import { fail, limited, parseBody } from "@/lib/api";
import { ticketTrackSchema } from "@/lib/validations";
import { normalizeTicketCode } from "@/lib/support";

// Lost your ticket link? Ticket number + the email you used gets you back in.
export async function POST(req: NextRequest) {
  const blocked = limited(`track:${clientIp(req)}`, 10, 10 * 60 * 1000);
  if (blocked) return blocked;

  const { data, error } = await parseBody(req, ticketTrackSchema);
  if (error) return error;

  const ticket = await prisma.supportTicket.findFirst({
    where: { code: normalizeTicketCode(data.code), email: data.email },
    select: { accessToken: true },
  });
  if (!ticket) return fail("No ticket found with that number and email.", 404);

  return NextResponse.json({ path: `/support/ticket/${ticket.accessToken}` });
}
