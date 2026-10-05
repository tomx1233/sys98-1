import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/auth";
import { emailEnabled } from "@/lib/email";
import { T } from "@/components/LangProvider";
import { Time } from "@/components/Time";
import { Icon } from "@/components/Icon";
import { StatusPill, CategoryTag } from "@/components/StatusPill";
import { Thread } from "@/components/support/Thread";
import { StatusSwitch, StaffReply } from "@/components/dashboard/TicketControls";

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaffPage();
  const { id } = await params;
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: { staff: { select: { username: true, profile: { select: { displayName: true } } } } },
      },
    },
  });
  if (!ticket) notFound();

  const messages = ticket.messages.map((m) => ({
    id: m.id,
    fromStaff: m.fromStaff,
    author: m.fromStaff ? m.staff?.profile?.displayName || m.staff?.username || "staff" : ticket.name,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
  }));

  return (
    <>
      <Link href="/dashboard" className="backlink"><Icon name="back" size={14} /> <T k="dash.tickets" /></Link>
      <div className="dash-head" style={{ marginTop: 14 }}>
        <h1 style={{ overflowWrap: "anywhere" }}>{ticket.subject}</h1>
      </div>

      <div className="meta-row">
        <StatusPill status={ticket.status} />
        <CategoryTag category={ticket.category} />
        <span className="mono muted">{ticket.code}</span>
        <span className="muted"><T k="ticket.opened" /> <Time iso={ticket.createdAt.toISOString()} mode="full" /></span>
      </div>
      <p className="from-line">
        <b>{ticket.name}</b> · <a href={`mailto:${ticket.email}`}>{ticket.email}</a>
        <span className="app-tag" style={{ marginLeft: 8, marginTop: 0 }}><T k="dash.writesIn" /> {ticket.lang.toUpperCase()}</span>
      </p>

      <div style={{ margin: "18px 0 22px" }}>
        <StatusSwitch id={ticket.id} status={ticket.status} />
      </div>

      <Thread messages={messages} />
      <StaffReply id={ticket.id} mailOn={emailEnabled()} visitorName={ticket.name} />
    </>
  );
}
