import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPrisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";
import EmployeeDashboard from "./ui/EmployeeDashboard";
import { defaultLocale } from "@/i18n/routing";

export default async function PortalDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("portal.dashboardRoot");
  const user = await getCurrentUser();
  if (!user || user.role !== "EMPLOYEE" || !user.employeeId) {
    redirect(`/${locale}/portal`);
  }

  const prisma = getPrisma();
  const employee = await prisma.employee.findUnique({
    where: { id: user.employeeId },
    select: { publicId: true, locale: true },
  });
  if (!employee) redirect(`/${locale}/portal`);
  const employeeLocale = employee.locale || defaultLocale;
  if (employeeLocale !== locale) {
    redirect(`/${employeeLocale}/portal/${employee.publicId}/dashboard`);
  }

  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {t("subtitle")}
          </p>
        </div>
        <Link
          className="rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-black/5 dark:text-zinc-200 dark:hover:bg-white/10"
          href={`/${locale}/portal/${employee.publicId}`}
        >
          {t("portalLink")}
        </Link>
      </div>

      <div className="mt-6">
        <EmployeeDashboard publicId={employee.publicId} locale={locale} />
      </div>
    </div>
  );
}
