import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";
import { logAudit } from "@/server/audit/log";
import { assertSameOrigin } from "@/server/security/csrf";

async function requireAdminOr401() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; txId: string }> },
) {
  await assertSameOrigin();
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: employeeId, txId } = await ctx.params;
  const prisma = getPrisma();
  const existing = await prisma.debtTransaction.findFirst({ where: { id: txId, employeeId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (existing.voidedAt) {
    return NextResponse.json({ error: "Already voided" }, { status: 409 });
  }

  await prisma.debtTransaction.update({
    where: { id: existing.id },
    data: { voidedAt: new Date(), voidedByUserId: user.userId },
  });

  await logAudit({
    actorUserId: user.userId,
    actorRole: "ADMIN",
    action: "DEBT_TX_VOID",
    entityType: "DebtTransaction",
    entityId: existing.id,
    metadata: { employeeId, amountCents: existing.amountCents, type: existing.type },
  });

  return NextResponse.json({ ok: true });
}
