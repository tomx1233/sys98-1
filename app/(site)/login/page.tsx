import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/auth";
import { Win } from "@/components/Win";
import { T } from "@/components/LangProvider";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Staff login", robots: { index: false } };
export const dynamic = "force-dynamic";

function safeNext(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v && v.startsWith("/dashboard") && !v.startsWith("//") ? v : "/dashboard";
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const next = safeNext((await searchParams).next);
  if (await getCurrentStaff()) redirect(next);

  return (
    <Win title="login.sh">
      <div className="page-hero">
        <span className="eyebrow"><T k="auth.eyebrow" /></span>
        <h1><T k="auth.loginTitle" /></h1>
        <p className="lead-sm"><T k="auth.loginLead" /></p>
      </div>
      <LoginForm next={next} />
      <div className="sec-foot">
        <span><T k="auth.haveKey" /> <Link href="/join"><T k="auth.joinLink" /></Link></span>
        <span><T k="auth.notStaff" /> <Link href="/support"><T k="auth.toSupport" /></Link></span>
      </div>
    </Win>
  );
}
