"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useT } from "@/components/LangProvider";
import { Avatar } from "@/components/staff/Avatar";
import { send } from "@/lib/client";
import type { Key } from "@/lib/i18n";

interface Item {
  href: string;
  label: Key;
  icon: "tickets" | "profile" | "settings" | "keys" | "team" | "audit" | "status";
  exact?: boolean;
  count?: number;
}

export function DashTitle() {
  const path = usePathname();
  return <>{"~" + path}</>;
}

export function DashNav({
  owner,
  openCount,
  me,
}: {
  owner: boolean;
  openCount: number;
  me: { name: string; username: string; avatarUrl: string | null; accent: string };
}) {
  const t = useT();
  const path = usePathname();

  const main: Item[] = [
    { href: "/dashboard", label: "dash.tickets", icon: "tickets", count: openCount },
    { href: "/dashboard/incidents", label: "dash.incidents", icon: "status" },
    { href: "/dashboard/profile", label: "dash.profile", icon: "profile" },
    { href: "/dashboard/settings", label: "dash.settings", icon: "settings" },
  ];
  const admin: Item[] = [
    { href: "/dashboard/keys", label: "dash.keys", icon: "keys" },
    { href: "/dashboard/team", label: "dash.team", icon: "team" },
    { href: "/dashboard/audit", label: "dash.audit", icon: "audit" },
  ];

  const active = (i: Item) =>
    i.href === "/dashboard" ? path === "/dashboard" || path.startsWith("/dashboard/tickets") : path.startsWith(i.href);

  const render = (i: Item) => (
    <Link key={i.href} href={i.href} className={active(i) ? "active" : ""} aria-current={active(i) ? "page" : undefined}>
      <Icon name={i.icon} />
      <span>{t(i.label)}</span>
      {!!i.count && <span className="count">{i.count}</span>}
    </Link>
  );

  async function logout() {
    await send("/api/auth/logout", "POST");
    window.location.assign("/");
  }

  return (
    <aside className="dash-side">
      <nav className="dash-nav" aria-label="dashboard">
        {main.map(render)}
        {owner && (
          <>
            <span className="dash-group">{t("dash.owner")}</span>
            {admin.map(render)}
          </>
        )}
      </nav>
      <div className="dash-me">
        <Avatar name={me.name} url={me.avatarUrl} accent={me.accent} />
        <div className="dash-me-text">
          <b>{me.name}</b>
          <Link href={`/staff/${me.username}`} className="muted">@{me.username}</Link>
        </div>
        <button type="button" className="tray-btn" onClick={logout} title={t("dash.logout")} aria-label={t("dash.logout")}>
          <Icon name="logout" />
        </button>
      </div>
    </aside>
  );
}
