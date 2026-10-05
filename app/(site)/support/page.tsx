import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Win } from "@/components/Win";
import { T } from "@/components/LangProvider";
import { SupportForm } from "@/components/support/SupportForm";
import { TrackForm } from "@/components/support/TrackForm";
import { Avatar } from "@/components/staff/Avatar";

export const metadata: Metadata = { title: "Support" };
export const dynamic = "force-dynamic";

const FAQ = ["1", "2", "3", "4", "5", "6"] as const;

async function loadTeam() {
  try {
    return await prisma.staffProfile.findMany({
      where: { isPublic: true, staff: { disabled: false } },
      include: { staff: { select: { username: true } } },
      orderBy: { createdAt: "asc" },
      take: 8,
    });
  } catch (err) {
    console.error("[support] couldn't load team strip:", err);
    return [];
  }
}

export default async function SupportPage() {
  const team = await loadTeam();

  return (
    <>
      <Win title="support.sh">
        <div className="hero-body" style={{ paddingBottom: 32 }}>
          <span className="eyebrow-mono"><T k="support.eyebrow" /></span>
          <h1 className="page-h1"><T k="support.h1" /></h1>
          <p className="lead" style={{ marginTop: 16, maxWidth: "58ch", fontSize: 17, color: "var(--muted)" }}>
            <T k="support.lead" />
          </p>
          <div className="hero-meta">
            <span><b><T k="support.meta1" /></b></span>
            <span><T k="support.meta2" /></span>
            <span><T k="support.meta3" /></span>
          </div>
        </div>
      </Win>

      <Win title="new-ticket.txt" id="new">
        <SupportForm />
      </Win>

      <Win title="find-ticket.txt">
        <TrackForm />
      </Win>

      <Win title="faq.txt">
        <div className="sec" style={{ paddingTop: 12, paddingBottom: 20 }}>
          {FAQ.map((n) => (
            <details className="faq" key={n}>
              <summary><T k={`faq.q${n}` as `faq.q1`} /></summary>
              <p>
                <T k={`faq.a${n}` as `faq.a1`} />
                {n === "5" && (
                  <>
                    {" "}
                    <a href="/privacy"><T k="faq.privacy" /></a>
                  </>
                )}
              </p>
            </details>
          ))}
        </div>
      </Win>

      {team.length > 0 && (
        <Win title="~/staff">
          <div className="tools-intro">
            <h2><T k="team.h2" /></h2>
            <p><T k="team.p" /></p>
          </div>
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
      )}
    </>
  );
}
