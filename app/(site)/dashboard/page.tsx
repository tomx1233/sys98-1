import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/auth";
import { T } from "@/components/LangProvider";
import { Time } from "@/components/Time";
import { StatusPill, CategoryTag } from "@/components/StatusPill";
import { previewText } from "@/lib/utils";
import { STATUSES } from "@/lib/constants";

const ORDER: Record<string, number> = { open: 0, pending: 1, resolved: 2, closed: 3 };

export default async function TicketsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaffPage();
  const sp = await searchParams;
  const rawStatus = Array.isArray(sp.status) ? sp.status[0] : sp.status;
  const status = rawStatus === "all" || (STATUSES as readonly string[]).includes(rawStatus ?? "") ? rawStatus! : "open";
  const q = ((Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "").trim().slice(0, 80);

  const [grouped, tickets] = await Promise.all([
    prisma.supportTicket.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.supportTicket.findMany({
      where: {
        ...(status !== "all" ? { status } : {}),
        ...(q
          ? {
              OR: [
                { code: { contains: q, mode: "insensitive" as const } },
                { subject: { contains: q, mode: "insensitive" as const } },
                { email: { contains: q, mode: "insensitive" as const } },
                { name: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
  ]);

  const counts: Record<string, number> = Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (status === "all") tickets.sort((a, b) => ORDER[a.status] - ORDER[b.status] || b.updatedAt.getTime() - a.updatedAt.getTime());

  const href = (s: string) => `/dashboard?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <>
      <div className="dash-head">
        <h1><T k="dash.tickets" /></h1>
        <form className="search" action="/dashboard" method="get">
          <input type="hidden" name="status" value={status} />
          <input className="text-input" name="q" defaultValue={q} placeholder="T-…, mail, subject" aria-label="search" />
        </form>
      </div>

      <div className="tabs" role="tablist">
        {[...STATUSES, "all"].map((s) => (
          <Link key={s} href={href(s)} className={`tab${status === s ? " active" : ""}`} role="tab" aria-selected={status === s}>
            <T k={`status.${s}` as "status.open"} />
            <span className="count">{s === "all" ? total : counts[s] ?? 0}</span>
          </Link>
        ))}
      </div>

      {tickets.length === 0 ? (
        <div className="empty"><T k={q ? "dash.noMatch" : "dash.inboxEmpty"} /></div>
      ) : (
        <div className="trows">
          {tickets.map((tk) => {
            const last = tk.messages[0];
            return (
              <Link key={tk.id} href={`/dashboard/tickets/${tk.id}`} className="trow">
                <StatusPill status={tk.status} />
                <div className="trow-main">
                  <b>{tk.subject}</b>
                  <span className="trow-sub">
                    {tk.name} · <CategoryTag category={tk.category} />
                    {last && <span className="muted"> · {last.fromStaff ? "↩ " : ""}{previewText(last.body, 90)}</span>}
                  </span>
                </div>
                <div className="trow-meta">
                  <Time iso={tk.updatedAt.toISOString()} />
                  <span className="mono muted">{tk.code}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
