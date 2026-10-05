import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type AuditAction =
  | "staff_join"
  | "staff_disable"
  | "staff_enable"
  | "staff_role"
  | "staff_reset_password"
  | "staff_2fa_enable"
  | "staff_2fa_disable"
  | "staff_2fa_reset"
  | "key_create"
  | "key_disable"
  | "key_enable"
  | "ticket_status"
  | "ticket_reply"
  | "incident_create"
  | "incident_update"
  | "incident_delete";

export async function audit(opts: {
  staffId: string | null;
  action: AuditAction;
  targetType: "staff" | "key" | "ticket" | "incident";
  targetId?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        staffId: opts.staffId,
        action: opts.action,
        targetType: opts.targetType,
        targetId: opts.targetId,
        metadata: opts.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (err) {
    // An audit hiccup should never break the action it describes.
    console.error("[audit] failed to write log entry:", err);
  }
}
