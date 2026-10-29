import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getPrisma } from "@/server/db/prisma";
import EmployeeTable from "./ui/EmployeeTable";

export default async function EmployeesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const t = await getTranslations("admin.employees");
  const prisma = getPrisma();
  const { locale } = await params;
  const [employees, calendars] = await Promise.all([
    prisma.employee.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: { holidayCalendar: true },
    }),
    prisma.holidayCalendar.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {t("subtitle")}
          </p>
        </div>
        <Link
          className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
          href={`/${locale}/admin/employees/new`}
        >
          {t("newEmployee")}
        </Link>
      </div>

      <EmployeeTable
        locale={locale}
        employees={employees.map((employee) => ({
          id: employee.id,
          publicId: employee.publicId,
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email ?? null,
          payFrequency: employee.payFrequency,
          attendanceSource: employee.attendanceSource,
          dailyRateCents: employee.dailyRateCents,
          currency: employee.currency,
          holidayCalendarName: employee.holidayCalendar?.name ?? null,
        }))}
      />

      <div className="text-xs text-zinc-500 dark:text-zinc-400">
        {t("calendarCount", { count: calendars.length })}
      </div>
    </div>
  );
}
