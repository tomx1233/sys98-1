import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, limited, parseBody, requireStaffApi } from "@/lib/api";
import { messageSchema } from "@/lib/validations";
import { ticketUrl } from "@/lib/support";
import { emailEnabled, sendEmail } from "@/lib/email";
import { ticketReplyEmail } from "@/lib/emailTemplates";
import { audit } from "@/lib/audit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { staff, error } = await requireStaffApi();
  if (error) return error;

  const blocked = limited(`staff-reply:${staff.id}`, 60, 10 * 60 * 1000);
  if (blocked) return blocked;

  const { data, error: bad } = await parseBody(req, messageSchema);
  if (bad) return bad;

  const ticket = await prisma.supportTicket.findUnique({ where: { id } });
  if (!ticket) return fail("Not found", 404);

  await prisma.$transaction([
    prisma.supportMessage.create({
      data: { ticketId: id, fromStaff: true, staffId: staff.id, body: data.body },
    }),
    // ball is in the visitor's court now
    prisma.supportTicket.update({ where: { id }, data: { status: "pending" } }),
  ]);
  await audit({ staffId: staff.id, action: "ticket_reply", targetType: "ticket", targetId: id });

  const staffName = staff.profile?.displayName || staff.username;
  after(async () => {
    const mail = ticketReplyEmail({
      name: ticket.name,
      code: ticket.code,
      url: ticketUrl(ticket.accessToken),
      subject: ticket.subject,
      staffName,
      body: data.body,
      lang: ticket.lang,
    });
    await sendEmail({ to: ticket.email, ...mail });
  });

  return NextResponse.json({ ok: true, emailed: emailEnabled() });
}
