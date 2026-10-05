import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { clientIp } from "@/lib/rateLimit";
import { limited, parseBody } from "@/lib/api";
import { ticketCreateSchema } from "@/lib/validations";
import { newAccessToken, newTicketCode, siteUrl, ticketUrl } from "@/lib/support";
import { emailEnabled, sendEmail } from "@/lib/email";
import { staffNotifyEmail, ticketCreatedEmail } from "@/lib/emailTemplates";

// Public: no account needed to open a ticket.
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const blocked = limited(`ticket:${ip}`, 6, 60 * 60 * 1000);
  if (blocked) return blocked;

  const { data, error } = await parseBody(req, ticketCreateSchema);
  if (error) return error;

  // Honeypot: real people never see this field. Pretend it worked so bots don't adapt.
  if (data.website) {
    return NextResponse.json({ code: "T-000000", path: "/support" });
  }

  const blockedEmail = limited(`ticket-email:${data.email}`, 5, 60 * 60 * 1000);
  if (blockedEmail) return blockedEmail;

  const lang = (data.lang ?? "en").toLowerCase().slice(0, 5);

  let ticket = null;
  for (let attempt = 0; attempt < 5 && !ticket; attempt++) {
    try {
      ticket = await prisma.supportTicket.create({
        data: {
          code: newTicketCode(),
          accessToken: newAccessToken(),
          name: data.name,
          email: data.email,
          lang,
          subject: data.subject,
          category: data.category,
          messages: { create: { fromStaff: false, body: data.message } },
        },
      });
    } catch (e) {
      // ticket code collision → try another one
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    }
  }
  if (!ticket) throw new Error("Could not allocate a ticket code");

  const url = ticketUrl(ticket.accessToken);
  after(async () => {
    const mail = ticketCreatedEmail({
      name: ticket.name,
      code: ticket.code,
      url,
      subject: ticket.subject,
      lang: ticket.lang,
    });
    await sendEmail({ to: ticket.email, ...mail });

    const notify = process.env.SUPPORT_NOTIFY_EMAIL;
    if (notify) {
      const n = staffNotifyEmail({
        code: ticket.code,
        subject: ticket.subject,
        name: ticket.name,
        body: data.message,
        adminUrl: `${siteUrl()}/dashboard/tickets/${ticket.id}`,
        isReply: false,
      });
      await sendEmail({ to: notify, ...n });
    }
  });

  return NextResponse.json({
    code: ticket.code,
    path: `/support/ticket/${ticket.accessToken}`,
    emailed: emailEnabled(),
  });
}
