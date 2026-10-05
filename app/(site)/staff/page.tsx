import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Win } from "@/components/Win";
import { T } from "@/components/LangProvider";
import { Avatar } from "@/components/staff/Avatar";

export const metadata: Metadata = { title: "Team" };
export const dynamic = "force-dynamic";

export default async function StaffIndexPage() {
  const team = await prisma.staffProfile.findMany({
    where: { isPublic: true, staff: { disabled: false } },
    include: { staff: { select: { username: true, role: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <Win title="~/staff">
      <div className="tools-intro">
        <span className="eyebrow-mono"><T k="team.eyebrow" /></span>
        <h1 className="page-h1" style={{ marginTop: 8 }}><T k="team.h1" /></h1>
        <p style={{ marginTop: 8 }}><T k="team.lead" /></p>
      </div>
      {team.length === 0 && (
        <div className="sec" style={{ paddingTop: 0 }}>
          <div className="empty"><T k="team.empty" /></div>
        </div>
      )}
      {team.map((p) => (
        <Link key={p.id} className="app member" href={`/staff/${p.staff.username}`}>
          <Avatar name={p.displayName || p.staff.username} url={p.avatarUrl} accent={p.accent} />
          <div>
            <h3>{p.displayName || p.staff.username}</h3>
            <p>{p.title || `@${p.staff.username}`}{p.languages ? ` · ${p.languages}` : ""}</p>
          </div>
          <span className="app-open"><T k="team.open" /></span>
        </Link>
      ))}
    </Win>
  );
}
