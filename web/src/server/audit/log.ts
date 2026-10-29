import { getPrisma } from "@/server/db/prisma";

export async function logAudit(input: {
  actorUserId?: string | null;
  actorRole?: "ADMIN" | "EMPLOYEE" | null;
  action: string;
  entityType?: string;
  entityId?: string;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const prisma = getPrisma();
  await prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      actorRole: input.actorRole ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}

