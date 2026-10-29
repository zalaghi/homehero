import WeeklyEmailPanel from "./ui/WeeklyEmailPanel";
import DeleteButton from "@/components/DeleteButton";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPrisma } from "@/server/db/prisma";
import EmployeeForm from "../ui/EmployeeForm";
import IdentityUploads from "./ui/IdentityUploads";
import PushSubscriptionsPanel from "./ui/PushSubscriptionsPanel";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const t = await getTranslations("admin.employeeDetail");
  const prisma = getPrisma();
  const { locale, id } = await params;

  const [employee, calendars] = await Promise.all([
    prisma.employee.findUnique({ where: { id } }),
    prisma.holidayCalendar.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!employee) notFound();

  const tabClassName =
    "inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-900/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/30 dark:text-zinc-200 dark:hover:bg-white/10 dark:focus-visible:ring-white/40";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {employee.firstName} {employee.lastName}
          </h1>
          <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {t("portalLabel")}{" "}
            <Link className="underline" href={`/${locale}/portal/${employee.publicId}`}>
              /{locale}/portal/{employee.publicId}
            </Link>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              className={tabClassName}
              href={`/${locale}/admin/employees/${employee.id}/attendance`}
            >
              {t("tabs.attendance")}
            </Link>
            <Link
              className={tabClassName}
              href={`/${locale}/admin/employees/${employee.id}/expenses`}
            >
              {t("tabs.expenses")}
            </Link>
            <Link
              className={tabClassName}
              href={`/${locale}/admin/employees/${employee.id}/debt`}
            >
              {t("tabs.debt")}
            </Link>
            <Link
              className={tabClassName}
              href={`/${locale}/admin/employees/${employee.id}/pay-periods`}
            >
              {t("tabs.payPeriods")}
            </Link>
            <Link
              className="inline-flex items-center rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/30 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 dark:focus-visible:ring-white/40"
              href={`/${locale}/admin/employees/${employee.id}/accounting`}
            >
              {t("tabs.accounting")}
            </Link>
          </div>
        </div>
        <Link
          className="rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-black/5 dark:text-zinc-200 dark:hover:bg-white/10"
          href={`/${locale}/admin/employees`}
        >
          {t("back")}
        </Link>
      </div>

      <div className="rounded-xl border border-black/10 bg-white p-4 text-sm text-zinc-600 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-300">
        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {t("summary.title")}
        </div>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {t("summary.homeAddress")}
            </div>
            <div className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">
              {employee.homeAddress ? employee.homeAddress : t("summary.notProvided")}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {t("summary.emergencyContact")}
            </div>
            <div className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">
              {employee.emergencyContactName || employee.emergencyContactPhone
                ? [employee.emergencyContactName, employee.emergencyContactPhone]
                    .filter(Boolean)
                    .join(" • ")
                : t("summary.notProvided")}
            </div>
          </div>
        </div>
      </div>

      <EmployeeForm
        mode="edit"
        employeeId={employee.id}
        calendars={calendars.map((c) => ({ id: c.id, name: c.name }))}
        onDonePath={`/${locale}/admin/employees`}
        initial={{
          firstName: employee.firstName,
          lastName: employee.lastName,
          phoneE164: employee.phoneE164 ?? null,
          email: employee.email ?? null,
          homeAddress: employee.homeAddress ?? null,
          emergencyContactName: employee.emergencyContactName ?? null,
          emergencyContactPhone: employee.emergencyContactPhone ?? null,
          locale: employee.locale,
          timezone: employee.timezone,
          currency: employee.currency,
          payFrequency: employee.payFrequency,
          dailyRateCents: employee.dailyRateCents,
          openingDebtCents: employee.openingDebtCents,
          attendanceSource: employee.attendanceSource,
          unifiActorId: employee.unifiActorId ?? null,
          holidayCalendarId: employee.holidayCalendarId ?? null,
        }}
      />

      <WeeklyEmailPanel employeeId={employee.id} />
      <PushSubscriptionsPanel employeeId={employee.id} />

      <IdentityUploads employeeId={employee.id} />
      <div className="rounded-xl border border-red-200 p-4 dark:border-red-900"><DeleteButton url={`/api/admin/employees/${employee.id}`} name={`${employee.firstName} ${employee.lastName}`} redirectPath={`/${locale}/admin/employees`} /></div>
    </div>
  );
}
