import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getPrisma } from "@/server/db/prisma";

export default async function HolidayCalendarsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const t = await getTranslations("admin.holidayCalendars");
  const prisma = getPrisma();
  const { locale } = await params;
  const calendars = await prisma.holidayCalendar.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { holidays: true, employees: true } } },
  });

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
          href={`/${locale}/admin/holiday-calendars/new`}
        >
          {t("newCalendar")}
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-black/5 text-left dark:bg-white/10">
            <tr>
              <th className="px-4 py-3 font-medium">{t("columns.name")}</th>
              <th className="px-4 py-3 font-medium">{t("columns.timezone")}</th>
              <th className="px-4 py-3 font-medium">{t("columns.holidays")}</th>
              <th className="px-4 py-3 font-medium">{t("columns.employees")}</th>
              <th className="px-4 py-3 text-right">{t("columns.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {calendars.map((c) => (
              <tr
                key={c.id}
                className="border-t border-black/10 transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
              >
                <td className="px-4 py-3">
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {c.country ?? "-"} / {c.region ?? "-"} / {c.city ?? "-"} • {t("defaultLocale", { locale: c.defaultLocale })}
                  </div>
                </td>
                <td className="px-4 py-3">{c.timezone}</td>
                <td className="px-4 py-3">{c._count.holidays}</td>
                <td className="px-4 py-3">{c._count.employees}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    className="rounded-md border border-black/10 px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-black/5 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/10"
                    href={`/${locale}/admin/holiday-calendars/${c.id}`}
                  >
                    {t("actions.manage")}
                  </Link>
                </td>
              </tr>
            ))}
            {calendars.length === 0 ? (
              <tr>
                  <td className="px-4 py-8 text-center text-zinc-500" colSpan={5}>
                    {t("empty")}
                  </td>
                </tr>
              ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
