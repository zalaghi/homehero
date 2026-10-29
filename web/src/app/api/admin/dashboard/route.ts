import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { getPrisma } from "@/server/db/prisma";
import { formatIsoDateUTC, parseIsoDate } from "@/lib/payroll/date";
import { getPayPeriodForDate } from "@/lib/payroll/periods";

function addDaysUTC(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

async function requireAdminOr401() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export async function GET() {
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prisma = getPrisma();
  const todayIso = formatIsoDateUTC(new Date());
  const today = parseIsoDate(todayIso);
  const upcomingEnd = parseIsoDate(formatIsoDateUTC(addDaysUTC(today, 14)));

  const [
    employeesCount,
    todosOpenCount,
    essentialsNeedCount,
    absencesAwayNowCount,
    absencesUpcomingCount,
    awayNowItems,
    upcomingItems,
    todoItems,
    essentialNeeds,
  ] = await Promise.all([
    prisma.employee.count(),
    prisma.todoItem.count({ where: { status: "OPEN" } }),
    prisma.employeeEssentialNeed.count(),
    prisma.absence.count({
      where: {
        startDate: { lte: today },
        endDate: { gte: today },
      },
    }),
    prisma.absence.count({
      where: {
        startDate: { gt: today, lte: upcomingEnd },
      },
    }),
    prisma.absence.findMany({
      where: {
        startDate: { lte: today },
        endDate: { gte: today },
      },
      orderBy: { endDate: "asc" },
      take: 5,
      include: { employee: { select: { firstName: true, lastName: true } } },
    }),
    prisma.absence.findMany({
      where: {
        startDate: { gt: today, lte: upcomingEnd },
      },
      orderBy: { startDate: "asc" },
      take: 5,
      include: { employee: { select: { firstName: true, lastName: true } } },
    }),
    prisma.todoItem.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { assignedToEmployee: { select: { firstName: true, lastName: true } } },
    }),
    prisma.employeeEssentialNeed.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { employee: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  const employees = await prisma.employee.findMany({
    select: { id: true, payFrequency: true },
  });

  const currentPeriodChecks = await Promise.all(
    employees.map(async (employee) => {
      const period = getPayPeriodForDate(todayIso, employee.payFrequency);
      const startDate = parseIsoDate(period.startDate);
      const endDate = parseIsoDate(period.endDate);
      const existing = await prisma.payPeriod.findUnique({
        where: {
          employeeId_startDate_endDate: {
            employeeId: employee.id,
            startDate,
            endDate,
          },
        },
        select: { id: true },
      });
      return Boolean(existing);
    })
  );

  const currentPeriodsReady = currentPeriodChecks.filter(Boolean).length;

  return NextResponse.json({
    employees: { total: employeesCount },
    absences: { awayNow: absencesAwayNowCount, upcoming: absencesUpcomingCount },
    essentials: { neededSoon: essentialsNeedCount },
    todos: { open: todosOpenCount },
    payPeriods: { currentReady: currentPeriodsReady, totalEmployees: employeesCount },
    lists: {
      awayNow: awayNowItems.map((absence) => ({
        employee: `${absence.employee.firstName} ${absence.employee.lastName}`,
        until: formatIsoDateUTC(absence.endDate),
      })),
      upcoming: upcomingItems.map((absence) => ({
        employee: `${absence.employee.firstName} ${absence.employee.lastName}`,
        start: formatIsoDateUTC(absence.startDate),
      })),
      todos: todoItems.map((todo) => ({
        title: todo.title,
        employee: `${todo.assignedToEmployee.firstName} ${todo.assignedToEmployee.lastName}`,
      })),
      essentials: essentialNeeds.map((need) => ({
        name: need.name,
        employee: `${need.employee.firstName} ${need.employee.lastName}`,
      })),
    },
  });
}
