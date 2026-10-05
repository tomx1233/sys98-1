import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Win } from "@/components/Win";
import { T } from "@/components/LangProvider";
import { JoinForm } from "@/components/auth/JoinForm";

export const metadata: Metadata = { title: "Join the team", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function JoinPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (await getCurrentStaff()) redirect("/dashboard");
  const raw = (await searchParams).key;
  const initialKey = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  const noOwnerYet = (await prisma.staff.count({ where: { role: "owner" } })) === 0;

  return (
    <Win title="join.sh">
      <div className="page-hero">
        <span className="eyebrow"><T k="auth.eyebrow" /></span>
        <h1><T k="auth.joinTitle" /></h1>
        <p className="lead-sm"><T k="auth.joinLead" /></p>
      </div>
      {noOwnerYet && (
        <div className="sec" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <p className="legal-note" style={{ margin: 0 }}><T k="auth.firstOwner" /></p>
        </div>
      )}
      <JoinForm initialKey={initialKey} />
      <div className="sec-foot">
        <span><T k="auth.haveAccount" /> <Link href="/login"><T k="auth.loginLink" /></Link></span>
      </div>
    </Win>
  );
}
