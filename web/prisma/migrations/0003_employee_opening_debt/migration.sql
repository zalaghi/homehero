-- Add opening debt (carry-over) to Employee.
ALTER TABLE "Employee"
ADD COLUMN IF NOT EXISTS "openingDebtCents" INTEGER NOT NULL DEFAULT 0;

