-- AlterTable
ALTER TABLE "DebtTransaction" ADD COLUMN     "voidedAt" TIMESTAMP(3),
ADD COLUMN     "voidedByUserId" TEXT;

-- CreateEnum
CREATE TYPE "EmployeeNotificationType" AS ENUM ('WEEKEND_REQUEST_DECISION', 'TODO_ASSIGNED', 'ESSENTIALS_UPDATED');

-- CreateTable
CREATE TABLE "EmployeeNotification" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "EmployeeNotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "metadataJson" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeNotification_employeeId_createdAt_idx" ON "EmployeeNotification"("employeeId", "createdAt");

-- CreateIndex
CREATE INDEX "EmployeeNotification_employeeId_readAt_idx" ON "EmployeeNotification"("employeeId", "readAt");

-- AddForeignKey
ALTER TABLE "DebtTransaction" ADD CONSTRAINT "DebtTransaction_voidedByUserId_fkey" FOREIGN KEY ("voidedByUserId") REFERENCES "AuthUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeNotification" ADD CONSTRAINT "EmployeeNotification_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
