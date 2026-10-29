-- CreateTable
CREATE TABLE "EmployeePushSubscription" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeePushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeePushSubscription_endpoint_key" ON "EmployeePushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "EmployeePushSubscription_employeeId_idx" ON "EmployeePushSubscription"("employeeId");

-- AddForeignKey
ALTER TABLE "EmployeePushSubscription" ADD CONSTRAINT "EmployeePushSubscription_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
