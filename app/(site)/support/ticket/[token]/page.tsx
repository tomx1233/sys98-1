import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Win } from "@/components/Win";
import { T } from "@/components/LangProvider";
import { Time } from "@/components/Time";
import { StatusPill, CategoryTag } from "@/components/StatusPill";
import { Thread } from "@/components/support/Thread";
import { VisitorReply } from "@/components/support/VisitorReply";

// The token in the URL is the only key to this page: keep it out of search engines and referrers.
export const metadata: Metadata = {
  title: "Your ticket",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";

export default async function VisitorTicketPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ticket = await prisma.supportTicket.findUnique({
    where: { accessToken: token },
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
    author: m.fromStaff ? m.staff?.profile?.displayName || m.staff?.username || "system98" : ticket.name,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
  }));

  return (
    <>
      <Win title={`${ticket.code}.txt`}>
        <div className="sec">
          <Link href="/support" className="backlink"><T k="ticket.back" /></Link>
          <h1 className="page-h1" style={{ fontSize: "clamp(22px, 3.6vw, 28px)", marginTop: 14 }}>{ticket.subject}</h1>
          <div className="meta-row">
            <StatusPill status={ticket.status} />
            <CategoryTag category={ticket.category} />
            <span className="mono muted">{ticket.code}</span>
            <span className="muted"><T k="ticket.opened" /> <Time iso={ticket.createdAt.toISOString()} mode="date" /></span>
          </div>

          <div style={{ marginTop: 24 }}>
            <Thread messages={messages} />
          </div>

          {ticket.status === "closed" ? (
            <p className="legal-note" style={{ marginTop: 24 }}><T k="ticket.closedNote" /></p>
          ) : (
            <VisitorReply token={token} status={ticket.status} />
          )}
        </div>
      </Win>

      <p className="page-note"><T k="ticket.saveNote" /></p>
    </>
  );
}
