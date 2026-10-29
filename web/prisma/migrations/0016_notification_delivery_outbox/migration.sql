CREATE TABLE "NotificationDelivery" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "notificationId" TEXT NOT NULL REFERENCES "EmployeeNotification"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "subscriptionId" TEXT NOT NULL REFERENCES "EmployeePushSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "status" TEXT NOT NULL DEFAULT 'PENDING', "attempts" INTEGER NOT NULL DEFAULT 0,
 "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "lockedUntil" TIMESTAMP(3), "acceptedAt" TIMESTAMP(3), "receivedAt" TIMESTAMP(3), "clickedAt" TIMESTAMP(3),
 "lastError" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "NotificationDelivery_notificationId_subscriptionId_key" ON "NotificationDelivery"("notificationId", "subscriptionId");
CREATE INDEX "NotificationDelivery_status_nextAttemptAt_idx" ON "NotificationDelivery"("status", "nextAttemptAt");
