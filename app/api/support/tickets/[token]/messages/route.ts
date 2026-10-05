import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/rateLimit";
import { fail, limited, parseBody } from "@/lib/api";
import { messageSchema } from "@/lib/validations";
import { siteUrl } from "@/lib/support";
import { sendEmail } from "@/lib/email";
import { staffNotifyEmail } from "@/lib/emailTemplates";

// Visitor writes back (the token in the URL is the "login").
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const blocked = limited(`ticket-msg:${clientIp(req)}`, 30, 10 * 60 * 1000);
  if (blocked) return blocked;

  const { data, error } = await parseBody(req, messageSchema);
  if (error) return error;

  const ticket = await prisma.supportTicket.findUnique({ where: { accessToken: token } });
  if (!ticket) return fail("Not found", 404);
  if (ticket.status === "closed") {
    return fail("This ticket is closed — please open a new one.", 409);
  }
  const blockedTicket = limited(`ticket-msg-t:${ticket.id}`, 12, 10 * 60 * 1000);
  if (blockedTicket) return blockedTicket;

  await prisma.$transaction([
    prisma.supportMessage.create({ data: { ticketId: ticket.id, fromStaff: false, body: data.body } }),
    // a visitor reply always puts the ticket back in front of the team
    prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: "open" } }),
  ]);

  const notify = process.env.SUPPORT_NOTIFY_EMAIL;
  if (notify) {
    after(async () => {
      const n = staffNotifyEmail({
        code: ticket.code,
        subject: ticket.subject,
        name: ticket.name,
        body: data.body,
        adminUrl: `${siteUrl()}/dashboard/tickets/${ticket.id}`,
        isReply: true,
      });
      await sendEmail({ to: notify, ...n });
    });
  }

  return NextResponse.json({ ok: true });
}
