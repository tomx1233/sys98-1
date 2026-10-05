import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSystemStatus, type ComponentStatus } from "@/lib/systemStatus";
import { Win } from "@/components/Win";
import { T } from "@/components/LangProvider";
import { Time } from "@/components/Time";
import { IncidentCard, type IncidentView } from "@/components/IncidentCard";
import type { Key } from "@/lib/i18n";

export const metadata: Metadata = { title: "Status", description: "Is system98 working right now? Live checks and incident history." };
export const dynamic = "force-dynamic";

const DAY = 86_400_000;
const STATE_PILL: Record<ComponentStatus["state"], string> = { operational: "resolved", degraded: "pending", down: "down", off: "closed" };

async function loadIncidents(): Promise<IncidentView[] | null> {
  try {
    const rows = await prisma.incident.findMany({
      where: { OR: [{ status: { not: "resolved" } }, { createdAt: { gt: new Date(Date.now() - 30 * DAY) } }] },
      orderBy: { createdAt: "desc" },
      take: 60,
      include: {
        updates: {
          orderBy: { createdAt: "asc" },
          include: { staff: { select: { username: true, profile: { select: { displayName: true } } } } },
        },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      severity: r.severity,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
      updates: r.updates.map((u) => ({
        id: u.id,
        status: u.status,
        body: u.body,
        createdAt: u.createdAt.toISOString(),
        author: u.staff?.profile?.displayName || u.staff?.username || "system98",
      })),
    }));
  } catch (err) {
    console.error("[status] couldn't load incidents:", err);
    return null;
  }
}

const level = (sev: string) => (sev === "major" ? 2 : sev === "minor" ? 1 : 0);

export default async function StatusPage() {
  const [status, incidents] = await Promise.all([getSystemStatus(), loadIncidents()]);
  const list = incidents ?? [];
  const active = list.filter((i) => i.status !== "resolved");
  const past = list.filter((i) => i.status === "resolved");

  // overall = worst of the live checks and whatever staff have posted
  const liveLevel = status.overall === "down" ? 2 : status.overall === "degraded" ? 1 : 0;
  const incidentLevel = Math.max(0, ...active.map((i) => level(i.severity)));
  const overall = Math.max(liveLevel, incidentLevel);
  const banner = (["ok", "minor", "major"] as const)[overall];
  const bannerKey: Key = overall === 0 ? "status.allOk" : overall === 1 ? "status.someTrouble" : "status.someDown";

  // 30 day strip (UTC days): green unless an incident was open that day
  // eslint-disable-next-line react-hooks/purity -- force-dynamic server component: re-rendered per request, so Date.now() is intentional
  const now = Date.now();
  const todayStart = Math.floor(now / DAY) * DAY;
  const days = Array.from({ length: 30 }, (_, i) => {
    const start = todayStart - (29 - i) * DAY;
    const end = start + DAY;
    let lvl = 0;
    for (const inc of list) {
      const from = new Date(inc.createdAt).getTime();
      const to = inc.resolvedAt ? new Date(inc.resolvedAt).getTime() : now;
      if (from < end && to > start) lvl = Math.max(lvl, level(inc.severity));
    }
    if (i === 29) lvl = Math.max(lvl, liveLevel);
    return { date: new Date(start).toISOString().slice(0, 10), lvl };
  });

  return (
    <>
      <Win title="status.sh">
        <div className={`status-banner ${banner}`}>
          <span className="status-banner-dot" aria-hidden="true" />
          <div>
            <h1><T k={bannerKey} /></h1>
            <p>
              <T k="status.checked" /> <Time iso={status.checkedAt} /> · <T k="status.liveNote" />
            </p>
          </div>
        </div>
      </Win>

      {active.length > 0 && (
        <Win title="incidents.log">
          <div className="sec">
            <h2 className="h-md" style={{ marginBottom: 14 }}><T k="status.active" /></h2>
            <div className="stack-sm">
              {active.map((inc) => (
                <IncidentCard key={inc.id} inc={inc} />
              ))}
            </div>
          </div>
        </Win>
      )}

      <Win title="components.json">
        <div className="comps">
          {status.components.map((c) => (
            <div className="comp-row" key={c.key}>
              <div className="comp-name">
                <b><T k={`status.c.${c.key}` as Key} /></b>
                <span><T k={`status.cd.${c.key}` as Key} />{c.detail ? <> · <T k={`status.d.${c.detail}` as Key} /></> : null}</span>
              </div>
              <span className="comp-ms mono muted">{c.ms != null ? `${c.ms} ms` : ""}</span>
              <span className={`pill ${STATE_PILL[c.state]}`}><T k={`state.${c.state}` as Key} /></span>
            </div>
          ))}
        </div>
      </Win>

      <Win title="history.log">
        <div className="sec">
          <h2 className="h-md"><T k="status.history" /></h2>
          <div className="strip" role="img" aria-label="30 day history">
            {days.map((d) => (
              <span key={d.date} className={`strip-day l${d.lvl}`} title={d.date} />
            ))}
          </div>
          <div className="strip-legend">
            <span><i className="strip-day l0" /> <T k="status.legend.ok" /></span>
            <span><i className="strip-day l1" /> <T k="status.legend.minor" /></span>
            <span><i className="strip-day l2" /> <T k="status.legend.major" /></span>
          </div>

          <div style={{ marginTop: 26 }}>
            {incidents === null ? (
              <div className="empty"><T k="status.noHistory" /></div>
            ) : past.length === 0 ? (
              <div className="empty"><T k="status.noIncidents" /></div>
            ) : (
              <div className="stack-sm">
                {past.map((inc) => (
                  <IncidentCard key={inc.id} inc={inc} />
                ))}
              </div>
            )}
          </div>
        </div>
      </Win>

      <p className="page-note">
        <T k="status.footer" /> <Link href="/support"><T k="status.toSupport" /></Link> · <a href="/api/status">/api/status</a>
      </p>
    </>
  );
}
