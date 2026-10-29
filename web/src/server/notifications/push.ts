import webpush from "web-push";
import { receiptToken } from "./receiptToken";
import { getPrisma } from "@/server/db/prisma";
import { isTrustedPushEndpoint } from "./pushEndpoint";
export type PushPayload = { title: string; body: string; type: string; employeeId: string; url?: string; notificationId?: string; deliveryId?: string; receiptToken?: string; unreadCount?: number };
export function getVapidConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
}
export function isVapidConfigured() { return !!getVapidConfig(); }
export type PushResult = { accepted: boolean; retryable: boolean; expired: boolean; error: string | null };
export async function sendToSubscription(subscription: { endpoint: string; p256dh: string; auth: string }, payload: PushPayload): Promise<PushResult> {
  const vapid = getVapidConfig();
  if (!vapid) return { accepted: false, retryable: true, expired: false, error: "VAPID_CONFIG_MISSING" };
  if (!isTrustedPushEndpoint(subscription.endpoint)) return { accepted: false, retryable: false, expired: false, error: "INVALID_PUSH_ENDPOINT" };
  try {
    await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify(payload), {
      vapidDetails: vapid, TTL: 86400, urgency: "high", timeout: 10000,
    });
    return { accepted: true, retryable: false, expired: false, error: null };
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    return { accepted: false, retryable: !status || status === 408 || status === 429 || status >= 500,
      expired: status === 404 || status === 410, error: status ? `PUSH_HTTP_${status}` : "PUSH_NETWORK_ERROR" };
  }
}
// Explicit admin diagnostic sends. Normal notifications use the durable outbox.
export async function sendEmployeePush(payload: PushPayload) {
  if (!isVapidConfigured()) return { sent: 0, failed: 0, expired: 0, skipped: true };
  const prisma = getPrisma();
  const employee = await prisma.employee.findUnique({ where: { id: payload.employeeId }, select: { locale: true, publicId: true } });
  const subscriptions = await prisma.employeePushSubscription.findMany({ where: { employeeId: payload.employeeId } });
  let sent = 0, failed = 0, expired = 0;
  if (!employee || !subscriptions.length) return { sent, failed, expired, skipped: false };
  const notification = await prisma.employeeNotification.create({ data: { employeeId: payload.employeeId, title: payload.title, body: payload.body, type: "DIAGNOSTIC_TEST" } });
  const unreadCount = await prisma.employeeNotification.count({ where: { employeeId: payload.employeeId, readAt: null } });
  for (const subscription of subscriptions) {
    // Explicit tests are traced too, but are never automatically resent.
    const delivery = await prisma.notificationDelivery.create({ data: { notificationId: notification.id, subscriptionId: subscription.id, status: "TEST_SENDING", attempts: 1 } });
    const result = await sendToSubscription(subscription, { ...payload, unreadCount, notificationId: notification.id, deliveryId: delivery.id, receiptToken: receiptToken(delivery.id), url: `/${employee.locale}/portal/${employee.publicId}/notifications` });
    await prisma.notificationDelivery.update({ where: { id: delivery.id }, data: { status: result.accepted ? "ACCEPTED" : result.expired ? "EXPIRED" : "FAILED", acceptedAt: result.accepted ? new Date() : null, lastError: result.error } });
    if (result.accepted) sent++; else failed++;
    if (result.expired) {
      expired++;
      await prisma.employeePushSubscription.updateMany({ where: { id: subscription.id }, data: { expirationTime: new Date() } });
    }
  }
  return { sent, failed, expired, skipped: false };
}
