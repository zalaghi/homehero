ALTER TABLE "Employee" ADD COLUMN "weeklyEmailEnabled" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "weeklyEmailEnabledAt" TIMESTAMP(3);
CREATE TABLE "WeeklyPayrollEmail" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "employeeId" TEXT NOT NULL REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "weekStart" DATE NOT NULL, "weekEnd" DATE NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING',
 "attempts" INTEGER NOT NULL DEFAULT 0, "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "lockedUntil" TIMESTAMP(3), "recipient" TEXT NOT NULL, "payPeriodId" TEXT,
 "sentAt" TIMESTAMP(3), "messageId" TEXT, "lastError" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "WeeklyPayrollEmail_employeeId_weekStart_key" ON "WeeklyPayrollEmail"("employeeId", "weekStart");
CREATE INDEX "WeeklyPayrollEmail_status_nextAttemptAt_idx" ON "WeeklyPayrollEmail"("status", "nextAttemptAt");
