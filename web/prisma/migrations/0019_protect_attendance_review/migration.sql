CREATE TABLE "ProtectAttendanceSuggestion" (
 "id" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "date" DATE NOT NULL,
 "personName" TEXT NOT NULL, "alarmName" TEXT NOT NULL, "cameraName" TEXT NOT NULL,
 "seenAt" TIMESTAMP(3) NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING','APPROVED','DISMISSED')),
 "reviewedAt" TIMESTAMP(3), "reviewedByUserId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ProtectAttendanceSuggestion_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ProtectAttendanceSuggestion_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProtectAttendanceSuggestion_employeeId_date_key" ON "ProtectAttendanceSuggestion"("employeeId", "date");
CREATE INDEX "ProtectAttendanceSuggestion_status_createdAt_idx" ON "ProtectAttendanceSuggestion"("status", "createdAt");
