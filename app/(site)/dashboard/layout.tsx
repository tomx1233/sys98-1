import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Win } from "@/components/Win";
import { DashNav, DashTitle } from "@/components/dashboard/DashNav";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaffPage();
  const openCount = await prisma.supportTicket.count({ where: { status: "open" } });

  return (
    <Win title={<DashTitle />} className="dashwin">
      <div className="dash">
        <DashNav
          owner={staff.role === "owner"}
          openCount={openCount}
          me={{
            name: staff.profile?.displayName || staff.username,
            username: staff.username,
            avatarUrl: staff.profile?.avatarUrl ?? null,
            accent: staff.profile?.accent ?? "teal",
          }}
        />
        <div className="dash-main">{children}</div>
      </div>
    </Win>
  );
}
