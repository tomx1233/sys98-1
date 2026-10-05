import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/auth";
import { T } from "@/components/LangProvider";
import { ProfileEditor } from "@/components/dashboard/ProfileEditor";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const staff = await requireStaffPage();
  const welcome = (await searchParams).welcome === "1";
  const profile = await prisma.staffProfile.findUnique({
    where: { staffId: staff.id },
    include: { links: { orderBy: { order: "asc" } } },
  });

  return (
    <>
      <div className="dash-head">
        <h1><T k="dash.profile" /></h1>
        <a className="btn btn-line btn-sm" href={`/staff/${staff.username}`}><T k="pe.viewPublic" /></a>
      </div>
      {welcome && <p className="legal-note" style={{ margin: "0 0 20px" }}><T k="pe.welcome" /></p>}
      <ProfileEditor
        initial={{
          username: staff.username,
          role: staff.role,
          joinedAt: staff.createdAt.toISOString(),
          displayName: profile?.displayName ?? staff.username,
          title: profile?.title ?? "",
          bio: profile?.bio ?? "",
          languages: profile?.languages ?? "",
          avatarUrl: profile?.avatarUrl ?? "",
          accent: profile?.accent ?? "teal",
          isPublic: profile?.isPublic ?? true,
          links: (profile?.links ?? []).map((l) => ({ label: l.label, url: l.url })),
        }}
      />
    </>
  );
}
