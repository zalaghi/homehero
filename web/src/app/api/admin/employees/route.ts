import { timezoneSchema } from "@/lib/validation";
import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { getPrisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";
import { assertSameOrigin } from "@/server/security/csrf";
import { logAudit } from "@/server/audit/log";
import { maybeEncryptJson } from "@/server/security/encryption";

const EmployeeInput = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phoneE164: z.string().regex(/^\+[1-9]\d{7,14}$/).nullable(),
  email: z.string().email().nullable(),
  homeAddress: z.string().max(500).nullable(),
  emergencyContactName: z.string().max(100).nullable(),
  emergencyContactPhone: z.string().max(40).nullable(),
  locale: z.enum(["en", "es", "fa", "de"]),
  timezone: timezoneSchema,
  currency: z.string().regex(/^[A-Za-z]{3}$/),
  payFrequency: z.enum(["WEEKLY_ISO", "MONTHLY"]),
  dailyRateCents: z.number().int().nonnegative(),
  openingDebtCents: z.number().int(),
  attendanceSource: z.enum(["UNIFI", "MANUAL", "HYBRID"]),
  unifiActorId: z.string().max(128).nullable(),
  holidayCalendarId: z.string().nullable(),
  bankIban: z.string().min(10).max(64).nullable().optional(),
  bankName: z.string().trim().min(1).max(100).nullable().optional(),
}).superRefine((data, ctx) => {
  if (data.emergencyContactName && !data.emergencyContactPhone) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["emergencyContactPhone"],
      message: "Required when emergency contact name is provided.",
    });
  }
});

async function requireAdminOr401() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return null;
  }
  return user;
}

export async function GET() {
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prisma = getPrisma();
  const employees = await prisma.employee.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  return NextResponse.json({ employees });
}

export async function POST(req: Request) {
  await assertSameOrigin();
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prisma = getPrisma();
  const json = await req.json().catch(() => null);
  const parsed = EmployeeInput.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const data = parsed.data;
  const bankPayload =
    data.bankIban || data.bankName
      ? maybeEncryptJson({
          bankIban: data.bankIban ?? null,
          bankName: data.bankName?.trim() || null,
        })
      : null;

  // Generate a stable public portal id (non-secret).
  let publicId = nanoid(10);
  for (let i = 0; i < 5; i += 1) {
    try {
      const employee = await prisma.employee.create({
        data: {
          publicId,
          firstName: data.firstName,
          lastName: data.lastName,
          phoneE164: data.phoneE164,
          email: data.email ? data.email.trim().toLowerCase() : null,
          homeAddress: data.homeAddress,
          emergencyContactName: data.emergencyContactName,
          emergencyContactPhone: data.emergencyContactPhone,
          locale: data.locale,
          timezone: data.timezone,
          currency: data.currency.toUpperCase(),
          payFrequency: data.payFrequency,
          dailyRateCents: data.dailyRateCents,
          openingDebtCents: data.openingDebtCents,
          attendanceSource: data.attendanceSource,
          unifiActorId: data.unifiActorId,
          holidayCalendarId: data.holidayCalendarId,
          bankName: data.bankName?.trim() || null,
          bankIbanEncrypted: bankPayload,
        },
      });

      await logAudit({
        actorUserId: user.userId,
        actorRole: "ADMIN",
        action: "EMPLOYEE_CREATE",
        entityType: "Employee",
        entityId: employee.id,
        metadata: { publicId: employee.publicId },
      });

      return NextResponse.json({ employee });
    } catch (e: unknown) {
      const code = (e as { code?: string; meta?: { target?: string[] } } | null)?.code;
      const target = (e as { meta?: { target?: string[] } } | null)?.meta?.target ?? [];
      if (code === "P2002") {
        // Retry only if the conflict is on publicId; otherwise it's email/phone uniqueness.
        if (target.includes("publicId")) {
          publicId = nanoid(10);
          continue;
        }
        return NextResponse.json({ error: "Email or phone already exists" }, { status: 409 });
      }
      throw e;
    }
  }

  return NextResponse.json({ error: "Could not allocate public id" }, { status: 500 });
}
