import { assertSameOrigin } from "@/server/security/csrf";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";
import { logAudit } from "@/server/audit/log";

async function requireAdminOr401() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; expenseId: string }> },
) {
  await assertSameOrigin();
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: employeeId, expenseId } = await ctx.params;
  const prisma = getPrisma();

  const deleted = await prisma.cardExpense.findFirst({
    where: { id: expenseId, employeeId },
  });
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.cardExpense.delete({ where: { id: deleted.id } });

  await logAudit({
    actorUserId: user.userId,
    actorRole: "ADMIN",
    action: "CARD_EXPENSE_DELETE",
    entityType: "CardExpense",
    entityId: deleted.id,
    metadata: { employeeId },
  });

  return NextResponse.json({ ok: true });
}

