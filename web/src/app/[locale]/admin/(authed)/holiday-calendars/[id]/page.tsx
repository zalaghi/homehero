import DeleteButton from "@/components/DeleteButton";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPrisma } from "@/server/db/prisma";
import { parseHolidayNameJson } from "@/lib/holidays/importers";
import CalendarForm from "../ui/CalendarForm";
import ImportPanel from "./ui/ImportPanel";

export default async function HolidayCalendarDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const t = await getTranslations("admin.holidayCalendarDetail");
  const prisma = getPrisma();
  const { locale, id } = await params;

  const calendar = await prisma.holidayCalendar.findUnique({
    where: { id },
    include: { _count: { select: { holidays: true, employees: true } } },
  });
  if (!calendar) notFound();

  const holidays = await prisma.holiday.findMany({
    where: { calendarId: id },
    orderBy: { date: "desc" },
    take: 50,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{calendar.name}</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {t("summary", { holidays: calendar._count.holidays, employees: calendar._count.employees })}
          </p>
        </div>
        <Link
          className="rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-black/5 dark:text-zinc-200 dark:hover:bg-white/10"
          href={`/${locale}/admin/holiday-calendars`}
        >
          {t("back")}
        </Link>
      </div>

      <div><DeleteButton url={`/api/admin/holiday-calendars/${id}`} name={calendar.name} redirectPath={`/${locale}/admin/holiday-calendars`} /></div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t("settings")}</div>
          <div className="mt-3">
            <CalendarForm
              mode="edit"
              calendarId={calendar.id}
              onDonePath={`/${locale}/admin/holiday-calendars/${calendar.id}`}
              initial={{
                name: calendar.name,
                country: calendar.country,
                region: calendar.region,
                city: calendar.city,
                timezone: calendar.timezone,
                defaultLocale: calendar.defaultLocale,
              }}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t("import.title")}</div>
          <div className="mt-3">
            <ImportPanel
              calendarId={calendar.id}
              defaultLocale={calendar.defaultLocale}
              city={calendar.city ?? undefined}
            />
          </div>
          <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            {t("import.tip")}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-sm font-semibold">{t("recent.title")}</div>
        <div className="overflow-x-auto rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-black/5 text-left dark:bg-white/10">
              <tr>
                <th className="w-32 px-4 py-3 font-medium">{t("recent.columns.date")}</th>
                <th className="px-4 py-3 font-medium">{t("recent.columns.name")}</th>
                <th className="w-48 px-4 py-3 font-medium">{t("recent.columns.source")}</th>
              </tr>
            </thead>
            <tbody>
              {holidays.map((h) => {
                const nameByLocale = parseHolidayNameJson(h.nameJson);
                const name = nameByLocale[calendar.defaultLocale] ?? Object.values(nameByLocale)[0] ?? "";
                return (
                  <tr
                    key={h.id}
                    className="border-t border-black/10 transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
                  >
                    <td className="px-4 py-3">{h.date.toISOString().slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <div className="break-words">{name}</div>
                      <div className="mt-2"><DeleteButton url={`/api/admin/holiday-calendars/${id}/holidays/${h.id}`} name={`${h.date.toISOString().slice(0, 10)} — ${name}`} /></div>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">
                      {h.source}
                      {h.sourceRef ? ` • ${h.sourceRef}` : ""}
                    </td>
                  </tr>
                );
              })}
              {holidays.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-zinc-500" colSpan={3}>
                    {t("recent.empty")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
