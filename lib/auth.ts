import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getSession, SESSION_COOKIE } from "@/lib/session";

/** The logged-in staff member (with profile), or null. Disabled accounts count as logged out. */
export const getCurrentStaff = cache(async () => {
  // anonymous visitors never touch the session code or the database
  if (!(await cookies()).has(SESSION_COOKIE)) return null;
  const session = await getSession();
  if (!session.staffId) return null;
  const staff = await prisma.staff.findUnique({
    where: { id: session.staffId },
    include: { profile: true },
  });
  if (!staff || staff.disabled) return null;
  return staff;
});

export type CurrentStaff = NonNullable<Awaited<ReturnType<typeof getCurrentStaff>>>;

export async function requireStaffPage(): Promise<CurrentStaff> {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");
  return staff;
}

export async function requireOwnerPage(): Promise<CurrentStaff> {
  const staff = await requireStaffPage();
  if (staff.role !== "owner") redirect("/dashboard");
  return staff;
}
