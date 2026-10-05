import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/auth";
import { T } from "@/components/LangProvider";
import { Time } from "@/components/Time";
import { SettingsForms } from "@/components/dashboard/SettingsForms";
import { TwoFactorSection } from "@/components/dashboard/TwoFactorSection";

export default async function SettingsPage() {
  const staff = await requireStaffPage();
  const key = staff.keyId ? await prisma.staffKey.findUnique({ where: { id: staff.keyId }, select: { keyPrefix: true, label: true } }) : null;

  return (
    <>
      <div className="dash-head">
        <h1><T k="dash.settings" /></h1>
      </div>
      <dl className="pf-facts" style={{ marginBottom: 26 }}>
        <div><dt><T k="set.role" /></dt><dd>{staff.role}</dd></div>
        <div><dt><T k="profile.since" /></dt><dd><Time iso={staff.createdAt.toISOString()} mode="date" /></dd></div>
        <div><dt><T k="set.joinedWith" /></dt><dd className="mono">{key ? key.keyPrefix + "…" : "setup"}</dd></div>
        {staff.lastLoginAt && <div><dt><T k="set.lastLogin" /></dt><dd><Time iso={staff.lastLoginAt.toISOString()} /></dd></div>}
      </dl>
      <SettingsForms username={staff.username} email={staff.email} />
      <div style={{ marginTop: 18 }}>
        <TwoFactorSection enabled={staff.twoFactorEnabled} codesLeft={staff.twoFactorRecoveryCodes.length} />
      </div>
    </>
  );
}
