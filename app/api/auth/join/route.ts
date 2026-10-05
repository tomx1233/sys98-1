import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { getSession } from "@/lib/session";
import { clientIp } from "@/lib/rateLimit";
import { fail, limited, parseBody } from "@/lib/api";
import { joinSchema } from "@/lib/validations";
import { canonicalKey, hashKey, safeEqual } from "@/lib/keys";
import { audit } from "@/lib/audit";

class BadKey extends Error {}
class Taken extends Error {
  constructor(public field: "email" | "username") {
    super(field);
  }
}

/**
 * There is no open sign-up: you need a staff key an owner generated in the dashboard.
 * The one exception is the very first owner, who uses SETUP_KEY from the environment —
 * and only while no owner exists yet.
 */
export async function POST(req: NextRequest) {
  const blocked = limited(`join:${clientIp(req)}`, 10, 60 * 60 * 1000);
  if (blocked) return blocked;

  const { data, error } = await parseBody(req, joinSchema);
  if (error) return error;

  const canonical = canonicalKey(data.key);
  const passwordHash = await bcrypt.hash(data.password, 12);
  const genericBadKey = "That key doesn't work. It might be typed wrong, used up, expired or disabled.";

  try {
    const created = await prisma.$transaction(async (tx) => {
      // serialise sign-ups so two people can't both grab the "first owner" slot
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(9801)`;

      const [emailTaken, nameTaken] = await Promise.all([
        tx.staff.findUnique({ where: { email: data.email } }),
        tx.staff.findUnique({ where: { username: data.username.toLowerCase() } }),
      ]);

      const setupKey = process.env.SETUP_KEY ? canonicalKey(process.env.SETUP_KEY) : "";
      const ownerCount = await tx.staff.count({ where: { role: "owner" } });
      const isSetup = ownerCount === 0 && setupKey.length >= 8 && safeEqual(canonical, setupKey);

      let keyId: string | null = null;
      if (!isSetup) {
        const key = await tx.staffKey.findUnique({ where: { keyHash: hashKey(canonical) } });
        if (!key || key.disabled) throw new BadKey();
        if (key.expiresAt && key.expiresAt.getTime() < Date.now()) throw new BadKey();
        const claimed = await tx.staffKey.updateMany({
          where: { id: key.id, disabled: false, usedCount: { lt: key.maxUses } },
          data: { usedCount: { increment: 1 } },
        });
        if (claimed.count === 0) throw new BadKey();
        keyId = key.id;
      }

      if (emailTaken) throw new Taken("email");
      if (nameTaken) throw new Taken("username");

      const staff = await tx.staff.create({
        data: {
          email: data.email,
          username: data.username.toLowerCase(),
          passwordHash,
          role: isSetup ? "owner" : "staff",
          keyId,
          profile: { create: { displayName: data.username } },
        },
      });
      return { id: staff.id, role: staff.role, keyId };
    });

    await audit({
      staffId: created.id,
      action: "staff_join",
      targetType: "staff",
      targetId: created.id,
      metadata: { role: created.role, keyId: created.keyId },
    });

    const session = await getSession();
    session.staffId = created.id;
    await session.save();
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof BadKey) return fail(genericBadKey, 400);
    if (e instanceof Taken) {
      return fail(e.field === "email" ? "That email is already in use" : "That username is taken", 409);
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail("That email or username is already in use", 409);
    }
    throw e;
  }
}
