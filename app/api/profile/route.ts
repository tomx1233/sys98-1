import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseBody, requireStaffApi } from "@/lib/api";
import { profileSchema } from "@/lib/validations";

export async function PUT(req: NextRequest) {
  const { staff, error } = await requireStaffApi();
  if (error) return error;

  const { data, error: bad } = await parseBody(req, profileSchema);
  if (bad) return bad;

  const { links, avatarUrl, ...rest } = data;

  await prisma.$transaction(async (tx) => {
    const profile = await tx.staffProfile.upsert({
      where: { staffId: staff.id },
      create: { staffId: staff.id, ...rest, avatarUrl: avatarUrl || null },
      update: { ...rest, avatarUrl: avatarUrl || null },
    });
    await tx.staffLink.deleteMany({ where: { profileId: profile.id } });
    if (links.length) {
      await tx.staffLink.createMany({
        data: links.map((l, order) => ({ profileId: profile.id, label: l.label, url: l.url, order })),
      });
    }
  });

  return NextResponse.json({ ok: true });
}
