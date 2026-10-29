-- CreateEnum
CREATE TYPE "EssentialItemStatus" AS ENUM ('IN_STOCK', 'NEED_TO_BUY', 'BOUGHT');

-- CreateTable
CREATE TABLE "EssentialItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultQuantity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EssentialItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EssentialStatus" (
    "id" TEXT NOT NULL,
    "essentialItemId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "status" "EssentialItemStatus" NOT NULL DEFAULT 'IN_STOCK',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EssentialStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EssentialItem_isActive_idx" ON "EssentialItem"("isActive");

-- CreateIndex
CREATE INDEX "EssentialItem_createdByAdminId_idx" ON "EssentialItem"("createdByAdminId");

-- CreateIndex
CREATE UNIQUE INDEX "EssentialStatus_employeeId_essentialItemId_key" ON "EssentialStatus"("employeeId", "essentialItemId");

-- CreateIndex
CREATE INDEX "EssentialStatus_employeeId_status_idx" ON "EssentialStatus"("employeeId", "status");

-- CreateIndex
CREATE INDEX "EssentialStatus_essentialItemId_idx" ON "EssentialStatus"("essentialItemId");

-- AddForeignKey
ALTER TABLE "EssentialItem" ADD CONSTRAINT "EssentialItem_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "AuthUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EssentialStatus" ADD CONSTRAINT "EssentialStatus_essentialItemId_fkey" FOREIGN KEY ("essentialItemId") REFERENCES "EssentialItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EssentialStatus" ADD CONSTRAINT "EssentialStatus_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
