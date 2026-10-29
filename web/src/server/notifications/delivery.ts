import { getPrisma } from "@/server/db/prisma";
import { sendToSubscription } from "./push";
import { receiptToken } from "./receiptToken";
export function retryDelayMs(attempt: number) { return Math.min(3600000, 30000 * 2 ** Math.max(0, attempt - 1)); }
export async function processPushOutbox(limit = 25) {
  const prisma = getPrisma();
  const now = new Date();
  const due = await prisma.notificationDelivery.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: now }, OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }] },
    orderBy: { nextAttemptAt: "asc" }, take: limit,
  });
  let processed = 0;
  for (const entry of due) {
    const claim = await prisma.notificationDelivery.updateMany({
      where: { id: entry.id, status: "PENDING", OR: [{ lockedUntil: null }, { lockedUntil: { lte: new Date() } }] },
      data: { lockedUntil: new Date(Date.now() + 60000), attempts: { increment: 1 } },
    });
    if (!claim.count) continue;
    const job = await prisma.notificationDelivery.findUnique({ where: { id: entry.id }, include: { subscription: true, notification: { include: { employee: { select: { locale: true, publicId: true } } } } } });
    if (!job) continue;
    if (Date.now() - job.createdAt.getTime() > 86400000 || job.notification.readAt) {
      await prisma.notificationDelivery.update({ where: { id: job.id }, data: { status: "CANCELLED", lockedUntil: null, lastError: job.notification.readAt ? "ALREADY_READ" : "EXPIRED_AFTER_24H" } });
      continue;
    }
    const n = job.notification;
    const base = `/${n.employee.locale}/portal/${n.employee.publicId}`;
    const suffix = n.type === "TODO_ASSIGNED" ? "/todos" : n.type === "ESSENTIALS_UPDATED" ? "/essentials" : "/attendance";
    const unreadCount = await prisma.employeeNotification.count({ where: { employeeId: n.employeeId, readAt: null } });
    const result = await sendToSubscription(job.subscription, {
      employeeId: n.employeeId, title: n.title, body: n.body, type: n.type,
      unreadCount, url: base + suffix, notificationId: n.id, deliveryId: job.id, receiptToken: receiptToken(job.id),
    });
    await prisma.notificationDelivery.updateMany({ where: { id: job.id }, data: {
      status: result.accepted ? "ACCEPTED" : result.expired ? "EXPIRED" : result.retryable && job.attempts < 8 ? "PENDING" : "FAILED",
      acceptedAt: result.accepted ? new Date() : null, lastError: result.error, lockedUntil: null,
      nextAttemptAt: new Date(Date.now() + retryDelayMs(job.attempts)),
    } });
    // Keep diagnostics; expired devices are excluded from new deliveries until re-registration.
    if (result.expired) await prisma.employeePushSubscription.updateMany({ where: { id: job.subscriptionId }, data: { expirationTime: new Date() } });
    processed++;
  }
  return { processed };
}
