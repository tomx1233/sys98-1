import { Panelbar, Statusbar } from "@/components/Chrome";
import { getCurrentStaff } from "@/lib/auth";

// Same frame as the static pages: top panel, a stack of windows, status bar at the bottom.
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  // if the database is down the frame (and the status page) must still render
  const staff = await getCurrentStaff().catch(() => null);
  const me = staff ? { username: staff.username, role: staff.role } : null;
  return (
    <>
      <Panelbar me={me} />
      <main className="wrap stack">{children}</main>
      <Statusbar me={me} />
    </>
  );
}
