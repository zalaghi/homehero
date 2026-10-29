import {
  AttendanceDaySource,
  AttendanceSource,
  DebtTransactionType,
  HolidaySource,
  PayFrequency,
  PayPeriodStatus,
  UserRole,
} from "@prisma/client";
import { addDays, startOfWeek, subDays } from "date-fns";
import { nanoid } from "nanoid";

import { hashPassword } from "../src/server/auth/password";
import { getPrisma } from "../src/server/db/prisma";
import { saveUnifiConfig } from "../src/server/unifi/config";

function toDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

async function seedSettings(prisma: ReturnType<typeof getPrisma>) {
  const otpProvider = (process.env.OTP_PROVIDER ?? "DEV").toUpperCase();
  await prisma.appSetting.upsert({
    where: { key: "otp.provider" },
    update: { value: otpProvider },
    create: { key: "otp.provider", value: otpProvider },
  });

  const unifiBaseUrl = process.env.UNIFI_BASE_URL ?? "https://unifi.example.com";
  const unifiToken = process.env.UNIFI_API_TOKEN ?? "demo-token";
  const unifiTlsVerify = process.env.UNIFI_TLS_SKIP_VERIFY !== "true";
  await saveUnifiConfig({ host: unifiBaseUrl, token: unifiToken, tlsVerify: unifiTlsVerify });
}

async function seedDemoData() {
  const prisma = getPrisma();

  await seedSettings(prisma);

  const holidayCalendar = await prisma.holidayCalendar.upsert({
    where: { id: "demo-calendar" },
    update: {},
    create: {
      id: "demo-calendar",
      name: "Barcelona Office",
      country: "ES",
      city: "Barcelona",
      timezone: "Europe/Madrid",
      defaultLocale: "es",
    },
  });

  const demoHolidays = [
    {
      date: toDateOnly(subDays(new Date(), 30)),
      nameJson: '{"es":"Fiesta local"}',
      source: HolidaySource.IMPORT_URL,
    },
    {
      date: toDateOnly(subDays(new Date(), 7)),
      nameJson: '{"en":"Company retreat"}',
      source: HolidaySource.MANUAL,
    },
  ];

  for (const [index, holiday] of demoHolidays.entries()) {
    await prisma.holiday.upsert({
      where: { id: `demo-holiday-${index}` },
      update: holiday,
      create: {
        id: `demo-holiday-${index}`,
        calendarId: holidayCalendar.id,
        ...holiday,
      },
    });
  }

  const employee = await prisma.employee.upsert({
    where: { publicId: "EMP-DEMO-001" },
    update: {
      firstName: "Amira",
      lastName: "Serrano",
      phoneE164: "+34930111222",
      email: "amira.serrano@example.com",
      locale: "es",
      timezone: "Europe/Madrid",
      currency: "EUR",
      dailyRateCents: 9500,
      holidayCalendarId: holidayCalendar.id,
    },
    create: {
      publicId: "EMP-DEMO-001",
      firstName: "Amira",
      lastName: "Serrano",
      phoneE164: "+34930111222",
      email: "amira.serrano@example.com",
      locale: "es",
      timezone: "Europe/Madrid",
      currency: "EUR",
      payFrequency: PayFrequency.WEEKLY_ISO,
      dailyRateCents: 9500,
      openingDebtCents: 1200,
      attendanceSource: AttendanceSource.HYBRID,
      holidayCalendarId: holidayCalendar.id,
    },
  });

  const employeeUser = await prisma.authUser.upsert({
    where: { email: "amira.serrano@example.com" },
    update: { employeeId: employee.id },
    create: {
      role: UserRole.EMPLOYEE,
      email: "amira.serrano@example.com",
      passwordHash: await hashPassword("demo-employee-password"),
      employeeId: employee.id,
    },
  });

  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const attendanceDays = [0, 1, 2, 3, 4].map((offset) => {
    const date = toDateOnly(addDays(monday, offset));
    return {
      id: `demo-attendance-${offset}`,
      employeeId: employee.id,
      date,
      worked: offset !== 2, // Midweek personal day off
      authorizedExtra: offset === 4,
      firstEntryTime: offset !== 2 ? addDays(date, 0) : null,
      lastExitTime: offset !== 2 ? addDays(date, 0) : null,
      uncertainty: offset === 4,
      source: offset === 2 ? AttendanceDaySource.MANUAL : AttendanceDaySource.RESOLVED,
    };
  });

  for (const day of attendanceDays) {
    await prisma.attendanceDay.upsert({
      where: { id: day.id },
      update: {
        worked: day.worked,
        authorizedExtra: day.authorizedExtra,
        firstEntryTime: day.firstEntryTime ?? undefined,
        lastExitTime: day.lastExitTime ?? undefined,
        uncertainty: day.uncertainty,
        source: day.source,
      },
      create: day,
    });
  }

  await prisma.cardExpense.upsert({
    where: { id: "demo-card-expense" },
    update: {
      date: toDateOnly(subDays(new Date(), 2)),
      concept: "Metro pass reload",
      amountCents: 2000,
    },
    create: {
      id: "demo-card-expense",
      employeeId: employee.id,
      date: toDateOnly(subDays(new Date(), 2)),
      concept: "Metro pass reload",
      amountCents: 2000,
      currency: "EUR",
      createdByUserId: employeeUser.id,
    },
  });

  await prisma.debtTransaction.upsert({
    where: { id: "demo-debt-advance" },
    update: {
      date: toDateOnly(subDays(new Date(), 10)),
      type: DebtTransactionType.LOAN_GIVEN,
      amountCents: 5000,
    },
    create: {
      id: "demo-debt-advance",
      employeeId: employee.id,
      date: toDateOnly(subDays(new Date(), 10)),
      type: DebtTransactionType.LOAN_GIVEN,
      amountCents: 5000,
      currency: "EUR",
      note: "Advance for childcare",
      createdByUserId: employeeUser.id,
    },
  });

  const payPeriodStart = toDateOnly(subDays(monday, 7));
  const payPeriodEnd = toDateOnly(addDays(payPeriodStart, 6));
  await prisma.payPeriod.upsert({
    where: { id: "demo-pay-period" },
    update: {
      status: PayPeriodStatus.FINAL,
      paidAt: new Date(),
      grossPayCents: 4 * 9500,
      cardExpensesCents: 2000,
      loansCents: 5000,
      debtCollectedCents: 0,
      netPayCents: 4 * 9500 - 2000 - 5000,
      validDays: 4,
      dailyRateCents: 9500,
    },
    create: {
      id: "demo-pay-period",
      employeeId: employee.id,
      frequency: PayFrequency.WEEKLY_ISO,
      startDate: payPeriodStart,
      endDate: payPeriodEnd,
      status: PayPeriodStatus.FINAL,
      paidAt: new Date(),
      grossPayCents: 4 * 9500,
      cardExpensesCents: 2000,
      loansCents: 5000,
      debtCollectedCents: 0,
      netPayCents: 4 * 9500 - 2000 - 5000,
      validDays: 4,
      dailyRateCents: 9500,
      debtStartCents: 1200,
      debtEndCents: 1200 + 5000,
      currency: "EUR",
      receiptFileKey: `receipts/${nanoid(10)}.pdf`,
    },
  });

  console.log("Demo dataset installed. Accounts:");
  console.log("- Employee login: amira.serrano@example.com / demo-employee-password");
  console.log("- Admin login: set via ADMIN_EMAIL + ADMIN_PASSWORD envs (init service)");
}

seedDemoData()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
