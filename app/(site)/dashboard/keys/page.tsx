import { prisma } from "@/lib/prisma";
import { requireOwnerPage } from "@/lib/auth";
import { keyStatus } from "@/lib/keys";
import { T } from "@/components/LangProvider";
import { Time } from "@/components/Time";
import { KeyCreator, KeyToggle } from "@/components/dashboard/KeysManager";

export default async function KeysPage() {
  await requireOwnerPage();
  const keys = await prisma.staffKey.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      createdBy: { select: { username: true } },
      redeemedBy: { select: { username: true } },
    },
  });

  return (
    <>
      <div className="dash-head">
        <h1><T k="dash.keys" /></h1>
      </div>
      <p className="muted-p" style={{ marginTop: 0 }}><T k="keys.lead" /></p>
      <KeyCreator />

      <h2 className="h-md" style={{ margin: "30px 0 12px" }}><T k="keys.existing" /></h2>
      {keys.length === 0 ? (
        <div className="empty"><T k="keys.none" /></div>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th><T k="keys.colKey" /></th>
                <th><T k="keys.colFor" /></th>
                <th><T k="keys.colStatus" /></th>
                <th><T k="keys.colUsed" /></th>
                <th><T k="keys.colCreated" /></th>
                <th />
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => {
                const st = keyStatus(k);
                return (
                  <tr key={k.id}>
                    <td className="mono">{k.keyPrefix}…</td>
                    <td>{k.label || <span className="muted">—</span>}</td>
                    <td>
                      <span className={`pill ${st === "active" ? "resolved" : st === "used up" ? "open" : "closed"}`}>
                        <T k={`keys.st.${st.replace(" ", "")}` as "keys.st.active"} />
                      </span>
                    </td>
                    <td>
                      <span className="mono">{k.usedCount}/{k.maxUses}</span>
                      {k.redeemedBy.length > 0 && <span className="muted"> · {k.redeemedBy.map((r) => r.username).join(", ")}</span>}
                    </td>
                    <td className="muted nowrap">
                      <Time iso={k.createdAt.toISOString()} mode="date" />
                      {k.createdBy && <> · {k.createdBy.username}</>}
                      {k.expiresAt && (
                        <>
                          <br />
                          <T k="keys.expiresOn" /> <Time iso={k.expiresAt.toISOString()} mode="date" />
                        </>
                      )}
                    </td>
                    <td><KeyToggle id={k.id} disabled={k.disabled} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
