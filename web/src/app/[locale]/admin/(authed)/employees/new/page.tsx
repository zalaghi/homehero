import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getPrisma } from "@/server/db/prisma";
import EmployeeForm from "../ui/EmployeeForm";

export default async function NewEmployeePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const t = await getTranslations("admin.employeeNew");
  const prisma = getPrisma();
  const { locale } = await params;
  const calendars = await prisma.holidayCalendar.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {t("subtitle")}
        </p>
      </div>
      <EmployeeForm
        calendars={calendars.map((c) => ({ id: c.id, name: c.name }))}
        mode="create"
        onDonePath={`/${locale}/admin/employees`}
      />
      <Link
        className="text-left text-sm text-zinc-600 underline dark:text-zinc-400"
        href={`/${locale}/admin/employees`}
      >
        {t("cancel")}
      </Link>
    </div>
  );
}
