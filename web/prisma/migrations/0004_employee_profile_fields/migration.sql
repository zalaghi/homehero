-- Add optional employee profile fields for address and emergency contacts.
ALTER TABLE "Employee"
ADD COLUMN IF NOT EXISTS "homeAddress" TEXT,
ADD COLUMN IF NOT EXISTS "emergencyContactName" TEXT,
ADD COLUMN IF NOT EXISTS "emergencyContactPhone" TEXT;

-- Track expiration dates for uploaded documents.
ALTER TABLE "EmployeeDocument"
ADD COLUMN IF NOT EXISTS "expirationDate" TIMESTAMP(3);
