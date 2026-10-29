import Link from "next/link";
import { getTranslations } from "next-intl/server";
import CalendarForm from "../ui/CalendarForm";

export default async function NewHolidayCalendarPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("admin.holidayCalendarsNew");
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {t("subtitle")}
        </p>
      </div>
      <CalendarForm mode="create" onDonePath={`/${locale}/admin/holiday-calendars`} />
      <Link
        className="text-left text-sm text-zinc-600 underline dark:text-zinc-400"
        href={`/${locale}/admin/holiday-calendars`}
      >
        {t("cancel")}
      </Link>
    </div>
  );
}
