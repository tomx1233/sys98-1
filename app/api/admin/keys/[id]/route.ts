import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fail, parseBody, requireOwnerApi } from "@/lib/api";
import { audit } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { staff, error } = await requireOwnerApi();
  if (error) return error;

  const { data, error: bad } = await parseBody(req, z.object({ disabled: z.boolean() }));
  if (bad) return bad;

  const key = await prisma.staffKey.findUnique({ where: { id } });
  if (!key) return fail("Key not found", 404);

  await prisma.staffKey.update({ where: { id }, data: { disabled: data.disabled } });
  await audit({
    staffId: staff.id,
    action: data.disabled ? "key_disable" : "key_enable",
    targetType: "key",
    targetId: id,
    metadata: { keyPrefix: key.keyPrefix },
  });
  return NextResponse.json({ ok: true });
}
