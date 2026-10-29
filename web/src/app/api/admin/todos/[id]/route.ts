import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";
import { assertSameOrigin } from "@/server/security/csrf";
import { z } from "zod";

const Patch = z.object({ title: z.string().trim().min(1).max(200).optional(), description: z.string().trim().max(500).nullable().optional(), status: z.enum(["OPEN", "DONE"]).optional() });
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await assertSameOrigin(); const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { id } = await ctx.params;
  const prisma = getPrisma();
  const result = await prisma.$transaction(async tx => {
    const updated = await tx.todoItem.updateMany({ where: { id }, data: { ...parsed.data, ...(parsed.data.status ? { doneAt: parsed.data.status === "DONE" ? new Date() : null } : {}) } });
    if (updated.count) await tx.auditLog.create({ data: { actorUserId: user.userId, actorRole: "ADMIN", action: "TODO_UPDATE", entityType: "TodoItem", entityId: id } });
    return updated;
  });
  return NextResponse.json({ ok: !!result.count }, { status: result.count ? 200 : 404 });
}
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await assertSameOrigin(); const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const prisma = getPrisma();
  await prisma.$transaction(async tx => {
    await tx.todoItem.deleteMany({ where: { id } });
    await tx.auditLog.create({ data: { actorUserId: user.userId, actorRole: "ADMIN", action: "TODO_DELETE", entityType: "TodoItem", entityId: id } });
  });
  return NextResponse.json({ ok: true });
}
