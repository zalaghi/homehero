ALTER TABLE "EmployeePushSubscription" ADD COLUMN "userAgent" TEXT;

DROP INDEX IF EXISTS "EmployeePushSubscription_endpoint_key";
CREATE UNIQUE INDEX "EmployeePushSubscription_employeeId_endpoint_key"
  ON "EmployeePushSubscription"("employeeId", "endpoint");
