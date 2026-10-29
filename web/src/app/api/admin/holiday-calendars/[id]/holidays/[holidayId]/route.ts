import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";
import { assertSameOrigin } from "@/server/security/csrf";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string; holidayId: string }> }) {
  await assertSameOrigin(); const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, holidayId } = await ctx.params;
  await getPrisma().$transaction(async tx => {
    const result = await tx.holiday.deleteMany({ where: { id: holidayId, calendarId: id } });
    if (result.count) await tx.auditLog.create({ data: { actorUserId: user.userId, actorRole: "ADMIN", action: "HOLIDAY_DELETE", entityType: "Holiday", entityId: holidayId } });
  });
  return NextResponse.json({ ok: true });
}
