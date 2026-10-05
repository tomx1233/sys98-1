import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseBody, requireOwnerApi } from "@/lib/api";
import { keyCreateSchema } from "@/lib/validations";
import { canonicalKey, generateStaffKey, hashKey, keyPrefixOf, prettyKey } from "@/lib/keys";
import { audit } from "@/lib/audit";

// Owners only. The plaintext key is returned exactly once — only its hash is stored.
export async function POST(req: NextRequest) {
  const { staff, error } = await requireOwnerApi();
  if (error) return error;

  const { data, error: bad } = await parseBody(req, keyCreateSchema);
  if (bad) return bad;

  const expiresAt = data.expiresInDays ? new Date(Date.now() + data.expiresInDays * 86_400_000) : null;

  const keys: string[] = [];
  const rows = [];
  for (let i = 0; i < data.count; i++) {
    const canonical = canonicalKey(generateStaffKey());
    keys.push(prettyKey(canonical));
    rows.push({
      keyHash: hashKey(canonical),
      keyPrefix: keyPrefixOf(canonical),
      label: data.label,
      maxUses: data.maxUses,
      expiresAt,
      createdById: staff.id,
    });
  }
  await prisma.staffKey.createMany({ data: rows });
  await audit({
    staffId: staff.id,
    action: "key_create",
    targetType: "key",
    metadata: { count: data.count, label: data.label, maxUses: data.maxUses, expiresInDays: data.expiresInDays },
  });

  return NextResponse.json({ keys });
}
