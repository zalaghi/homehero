-- CreateEnum
CREATE TYPE "WeekendWorkRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "WeekendWorkRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "WeekendWorkRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeekendWorkRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WeekendWorkRequest_employeeId_date_key" ON "WeekendWorkRequest"("employeeId", "date");

-- CreateIndex
CREATE INDEX "WeekendWorkRequest_employeeId_status_idx" ON "WeekendWorkRequest"("employeeId", "status");

-- AddForeignKey
ALTER TABLE "WeekendWorkRequest" ADD CONSTRAINT "WeekendWorkRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
