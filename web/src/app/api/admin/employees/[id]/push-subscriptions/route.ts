import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";

async function requireAdminOr401() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const prisma = getPrisma();
  const subscriptions = await prisma.employeePushSubscription.findMany({
    where: { employeeId: id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      endpoint: true,
      userAgent: true,
      createdAt: true,
      updatedAt: true,
      expirationTime: true,
    },
  });

  const [deliveries, heartbeat] = await Promise.all([
    prisma.notificationDelivery.findMany({ where: { notification: { employeeId: id } }, orderBy: { createdAt: "desc" }, take: 30,
      select: { id: true, status: true, attempts: true, acceptedAt: true, receivedAt: true, clickedAt: true, lastError: true, createdAt: true, notification: { select: { title: true } } } }),
    prisma.appSetting.findUnique({ where: { key: "push.workerHeartbeat" } }),
  ]);
  return NextResponse.json({ subscriptions: subscriptions.map(sub => ({ ...sub, endpoint: new URL(sub.endpoint).hostname })), deliveries, workerHealthy: !!heartbeat && Date.now() - Date.parse(heartbeat.value) < 120000 });
}
