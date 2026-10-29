-- CreateEnum
CREATE TYPE "TodoStatus" AS ENUM ('OPEN', 'DONE');

-- CreateTable
CREATE TABLE "TodoItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TodoStatus" NOT NULL DEFAULT 'OPEN',
    "assignedToEmployeeId" TEXT NOT NULL,
    "createdByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "doneAt" TIMESTAMP(3),

    CONSTRAINT "TodoItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TodoItem_assignedToEmployeeId_status_idx" ON "TodoItem"("assignedToEmployeeId", "status");

-- CreateIndex
CREATE INDEX "TodoItem_createdByAdminId_idx" ON "TodoItem"("createdByAdminId");

-- AddForeignKey
ALTER TABLE "TodoItem" ADD CONSTRAINT "TodoItem_assignedToEmployeeId_fkey" FOREIGN KEY ("assignedToEmployeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoItem" ADD CONSTRAINT "TodoItem_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "AuthUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
