import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";
import { assertSameOrigin } from "@/server/security/csrf";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string; subscriptionId: string }> }) {
  await assertSameOrigin(); const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, subscriptionId } = await ctx.params;
  await getPrisma().$transaction(async tx => {
    const result = await tx.employeePushSubscription.deleteMany({ where: { id: subscriptionId, employeeId: id } });
    if (result.count) await tx.auditLog.create({ data: { actorUserId: user.userId, actorRole: "ADMIN", action: "EMPLOYEEPUSHSUBSCRIPTION_DELETE", entityType: "EmployeePushSubscription", entityId: subscriptionId } });
  });
  return NextResponse.json({ ok: true });
}
