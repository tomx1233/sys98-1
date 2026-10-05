import { prisma } from "@/lib/prisma";
import { requireOwnerPage } from "@/lib/auth";
import { T } from "@/components/LangProvider";
import { Time } from "@/components/Time";
import { TeamActions } from "@/components/dashboard/TeamActions";

export default async function TeamPage() {
  const me = await requireOwnerPage();
  const [staff, replies] = await Promise.all([
    prisma.staff.findMany({
      orderBy: { createdAt: "asc" },
      include: { profile: { select: { displayName: true } }, joinedWith: { select: { keyPrefix: true, label: true } } },
    }),
    prisma.supportMessage.groupBy({ by: ["staffId"], where: { fromStaff: true }, _count: { _all: true } }),
  ]);
  const replyCount = new Map(replies.map((r) => [r.staffId, r._count._all]));

  return (
    <>
      <div className="dash-head">
        <h1><T k="dash.team" /></h1>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th><T k="team.colWho" /></th>
              <th><T k="team.colRole" /></th>
              <th><T k="team.colActivity" /></th>
              <th><T k="team.colActions" /></th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className={s.disabled ? "dim" : ""}>
                <td>
                  <b>{s.profile?.displayName || s.username}</b>
                  <br />
                  <span className="mono muted">@{s.username}</span>
                  <br />
                  <span className="muted">{s.email}</span>
                </td>
                <td>
                  <span className={`pill ${s.role === "owner" ? "open" : "closed"}`}>{s.role}</span>
                  {s.disabled && <span className="pill pending" style={{ marginLeft: 6 }}><T k="team.disabled" /></span>}
                  <br />
                  <span className={`pill ${s.twoFactorEnabled ? "resolved" : "closed"}`} style={{ marginTop: 6 }}>2FA {s.twoFactorEnabled ? "on" : "off"}</span>
                </td>
                <td className="muted nowrap">
                  <T k="team.replies" v={{ n: replyCount.get(s.id) ?? 0 }} />
                  <br />
                  <T k="team.joined" /> <Time iso={s.createdAt.toISOString()} mode="date" />
                  {s.joinedWith && <> · <span className="mono">{s.joinedWith.keyPrefix}…</span></>}
                  <br />
                  <T k="team.lastLogin" /> {s.lastLoginAt ? <Time iso={s.lastLoginAt.toISOString()} /> : "—"}
                </td>
                <td style={{ minWidth: 230 }}>
                  <TeamActions id={s.id} username={s.username} role={s.role} disabled={s.disabled} isMe={s.id === me.id} twoFactor={s.twoFactorEnabled} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
