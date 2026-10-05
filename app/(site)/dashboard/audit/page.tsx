import { prisma } from "@/lib/prisma";
import { requireOwnerPage } from "@/lib/auth";
import { T } from "@/components/LangProvider";
import { Time } from "@/components/Time";

function describe(meta: unknown): string {
  if (!meta || typeof meta !== "object") return "";
  return Object.entries(meta as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ");
}

export default async function AuditPage() {
  await requireOwnerPage();
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 150,
    include: { staff: { select: { username: true } } },
  });

  return (
    <>
      <div className="dash-head">
        <h1><T k="dash.audit" /></h1>
      </div>
      <p className="muted-p" style={{ marginTop: 0 }}><T k="audit.lead" /></p>
      {logs.length === 0 ? (
        <div className="empty"><T k="audit.none" /></div>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th><T k="audit.when" /></th>
                <th><T k="audit.who" /></th>
                <th><T k="audit.what" /></th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="muted nowrap"><Time iso={l.createdAt.toISOString()} mode="full" /></td>
                  <td>{l.staff?.username ?? "—"}</td>
                  <td>
                    <span className="mono">{l.action}</span>
                    <span className="muted"> {describe(l.metadata)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
