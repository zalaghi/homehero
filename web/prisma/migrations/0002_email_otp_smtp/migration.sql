-- Add SMTP OTP provider
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'OtpProvider' AND e.enumlabel = 'SMTP') THEN
    ALTER TYPE "OtpProvider" ADD VALUE 'SMTP';
  END IF;
END$$;

-- Employee email
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "email" TEXT;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'Employee_email_key'
  ) THEN
    CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");
  END IF;
END$$;

-- OTP challenge recipient rename (phone -> generic recipient)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='OtpChallenge' AND column_name='phoneE164'
  ) THEN
    ALTER TABLE "OtpChallenge" RENAME COLUMN "phoneE164" TO "recipient";
  END IF;
END$$;

DROP INDEX IF EXISTS "OtpChallenge_phoneE164_expiresAt_idx";
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='OtpChallenge_recipient_expiresAt_idx'
  ) THEN
    CREATE INDEX "OtpChallenge_recipient_expiresAt_idx" ON "OtpChallenge"("recipient","expiresAt");
  END IF;
END$$;

