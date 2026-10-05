import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Win } from "@/components/Win";
import { T } from "@/components/LangProvider";
import { ProfileView } from "@/components/staff/ProfileView";
import { ViewPing } from "@/components/staff/ViewPing";

export const dynamic = "force-dynamic";

async function load(username: string) {
  const staff = await prisma.staff.findUnique({
    where: { username: username.toLowerCase() },
    include: { profile: { include: { links: { orderBy: { order: "asc" } } } } },
  });
  if (!staff || staff.disabled || !staff.profile || !staff.profile.isPublic) return null;
  return { staff, profile: staff.profile };
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const found = await load(username);
  if (!found) return { title: "Not found" };
  return {
    title: found.profile.displayName || found.staff.username,
    description: found.profile.bio || undefined,
  };
}

export default async function StaffProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const found = await load(username);
  if (!found) notFound();
  const { staff, profile } = found;

  return (
    <>
      <Win title={`~/staff/${staff.username}`}>
        <ProfileView
          p={{
            username: staff.username,
            role: staff.role,
            displayName: profile.displayName,
            title: profile.title,
            bio: profile.bio,
            languages: profile.languages,
            avatarUrl: profile.avatarUrl,
            accent: profile.accent,
            links: profile.links.map((l) => ({ label: l.label, url: l.url })),
            joinedAt: staff.createdAt.toISOString(),
            viewCount: profile.viewCount,
          }}
        />
        <div className="pf-foot">
          <Link className="btn btn-fill" href="/support"><T k="profile.write" /></Link>
          <Link className="btn btn-line" href="/staff"><T k="profile.all" /></Link>
        </div>
      </Win>
      <ViewPing username={staff.username} />
    </>
  );
}
