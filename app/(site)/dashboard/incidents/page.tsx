import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/auth";
import { T } from "@/components/LangProvider";
import { IncidentCard, type IncidentView } from "@/components/IncidentCard";
import { IncidentCreator, IncidentUpdater } from "@/components/dashboard/IncidentForms";

export default async function IncidentsPage() {
  const me = await requireStaffPage();
  const rows = await prisma.incident.findMany({
    orderBy: { createdAt: "desc" },
    take: 40,
    include: {
      updates: {
        orderBy: { createdAt: "asc" },
        include: { staff: { select: { username: true, profile: { select: { displayName: true } } } } },
      },
    },
  });
  const views: IncidentView[] = rows.map((r) => ({
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
  const active = views.filter((v) => v.status !== "resolved");
  const past = views.filter((v) => v.status === "resolved");
  const isOwner = me.role === "owner";

  return (
    <>
      <div className="dash-head">
        <h1><T k="dash.incidents" /></h1>
        <a className="btn btn-line btn-sm" href="/status"><T k="inc.publicPage" /></a>
      </div>
      <p className="muted-p" style={{ marginTop: 0 }}><T k="inc.lead" /></p>

      <IncidentCreator />

      <h2 className="h-md" style={{ margin: "30px 0 12px" }}><T k="inc.active" /></h2>
      {active.length === 0 ? (
        <div className="empty"><T k="inc.none" /></div>
      ) : (
        <div className="stack-sm">
          {active.map((inc) => (
            <IncidentCard key={inc.id} inc={inc}>
              <IncidentUpdater id={inc.id} status={inc.status} canDelete={isOwner} />
            </IncidentCard>
          ))}
        </div>
      )}

      {past.length > 0 && (
        <>
          <h2 className="h-md" style={{ margin: "30px 0 12px" }}><T k="inc.past" /></h2>
          <div className="stack-sm">
            {past.map((inc) => (
              <IncidentCard key={inc.id} inc={inc}>
                <IncidentUpdater id={inc.id} status={inc.status} canDelete={isOwner} />
              </IncidentCard>
            ))}
          </div>
        </>
      )}
    </>
  );
}
