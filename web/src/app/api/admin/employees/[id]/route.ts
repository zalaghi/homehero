import { timezoneSchema } from "@/lib/validation";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { getPrisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";
import { assertSameOrigin } from "@/server/security/csrf";
import { logAudit } from "@/server/audit/log";
import { maybeEncryptJson } from "@/server/security/encryption";

const EmployeePatch = z.object({
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
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  await assertSameOrigin();
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const prisma = getPrisma();

  const json = await req.json().catch(() => null);
  const parsed = EmployeePatch.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const data = parsed.data;
  const bankPayload =
    data.bankIban || data.bankName
      ? maybeEncryptJson({
          bankIban: data.bankIban ?? null,
          bankName: data.bankName?.trim() || null,
        })
      : null;
  let employee;
  try {
    const updateData: Prisma.EmployeeUpdateInput = {
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
    };

    if (data.bankName !== undefined) {
      updateData.bankName = data.bankName?.trim() || null;
    }
    if (data.bankIban !== undefined) {
      updateData.bankIbanEncrypted = bankPayload;
    }

    if (data.holidayCalendarId !== undefined) {
      updateData.holidayCalendar =
        data.holidayCalendarId === null
          ? { disconnect: true }
          : { connect: { id: data.holidayCalendarId } };
    }

    employee = await prisma.employee.update({
      where: { id },
      data: updateData,
    });
  } catch (e: unknown) {
    const code = (e as { code?: string } | null)?.code;
    if (code === "P2002") {
      return NextResponse.json({ error: "Email or phone already exists" }, { status: 409 });
    }
    throw e;
  }

  await logAudit({
    actorUserId: user.userId,
    actorRole: "ADMIN",
    action: "EMPLOYEE_UPDATE",
    entityType: "Employee",
    entityId: employee.id,
  });

  return NextResponse.json({ employee });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  await assertSameOrigin();
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const prisma = getPrisma();

  const result = await prisma.$transaction(async tx => {
    const employee = await tx.employee.findUnique({ where: { id }, include: { _count: { select: { attendanceDays: true, cardExpenses: true, debtTransactions: true, payPeriods: true, documents: true, protectSuggestions: true } } } });
    if (!employee) return "missing";
    if (employee.openingDebtCents !== 0 || Object.values(employee._count).some(count => count > 0)) return "history";
    await tx.authUser.deleteMany({ where: { employeeId: id, role: "EMPLOYEE" } });
    await tx.employee.delete({ where: { id } });
    return "deleted";
  }, { isolationLevel: "Serializable" });
  if (result === "missing") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (result === "history") return NextResponse.json({ error: "This employee has attendance, financial records, observations or documents. Deletion is blocked to preserve the history." }, { status: 409 });
  await logAudit({
    actorUserId: user.userId,
    actorRole: "ADMIN",
    action: "EMPLOYEE_DELETE",
    entityType: "Employee",
    entityId: id,
  });

  return NextResponse.json({ ok: true });
}
