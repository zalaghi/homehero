import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";
import { assertSameOrigin } from "@/server/security/csrf";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await assertSameOrigin(); const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  await getPrisma().$transaction(async tx => {
    const result = await tx.absence.deleteMany({ where: { id } });
    if (result.count) await tx.auditLog.create({ data: { actorUserId: user.userId, actorRole: "ADMIN", action: "ABSENCE_DELETE", entityType: "Absence", entityId: id } });
  });
  return NextResponse.json({ ok: true });
}
