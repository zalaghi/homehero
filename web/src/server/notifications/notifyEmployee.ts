import { getPrisma } from "@/server/db/prisma";
import { buildNotificationContent } from "./templates";
export async function notifyEmployee(input: { employeeId: string; type: "WEEKEND_REQUEST_DECISION" | "TODO_ASSIGNED" | "ESSENTIALS_UPDATED"; metadata?: Record<string, unknown> }): Promise<void> {
  const prisma = getPrisma();
  const employee = await prisma.employee.findUnique({ where: { id: input.employeeId }, select: { id: true, locale: true } });
  if (!employee) return;
  const content = buildNotificationContent({ type: input.type, locale: employee.locale === "es" ? "es" : "en", metadata: input.metadata ?? {} });
  await prisma.$transaction(async tx => {
    const subscriptions = await tx.employeePushSubscription.findMany({ where: { employeeId: employee.id, OR: [{ expirationTime: null }, { expirationTime: { gt: new Date() } }] }, select: { id: true } });
    await tx.employeeNotification.create({ data: {
      employeeId: employee.id, type: input.type, title: content.title, body: content.body,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
      deliveries: { create: subscriptions.map(sub => ({ subscriptionId: sub.id })) },
    } });
  });
}
