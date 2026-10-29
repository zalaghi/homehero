import { getCurrentUser } from "@/server/auth/session";
import { getPrisma } from "@/server/db/prisma";
import { assertSameOrigin } from "@/server/security/csrf";
import { z } from "zod";
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(); if (user?.role !== "ADMIN") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const employee = await getPrisma().employee.findUnique({ where: { id }, select: { weeklyEmailEnabled: true, weeklyEmailEnabledAt: true, email: true, weeklyEmails: { orderBy: { createdAt: "desc" }, take: 10 } } });
  if (!employee) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(employee);
}
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await assertSameOrigin(); const user = await getCurrentUser(); if (user?.role !== "ADMIN") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = z.object({ enabled: z.boolean() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });
  const { id } = await ctx.params, prisma = getPrisma();
  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) return Response.json({ error: "Not found" }, { status: 404 });
  if (parsed.data.enabled && (!employee.email || employee.payFrequency !== "WEEKLY_ISO")) return Response.json({ error: "An email address and weekly pay frequency are required." }, { status: 409 });
  await prisma.employee.update({ where: { id }, data: { weeklyEmailEnabled: parsed.data.enabled, ...(parsed.data.enabled && !employee.weeklyEmailEnabled ? { weeklyEmailEnabledAt: new Date() } : {}) } });
  await prisma.auditLog.create({ data: { actorUserId: user.userId, actorRole: "ADMIN", action: "WEEKLY_EMAIL_CONFIG", entityType: "Employee", entityId: id, metadataJson: JSON.stringify(parsed.data) } });
  return Response.json({ ok: true });
}
