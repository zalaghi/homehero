import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPrisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";
import PullToRefresh from "@/components/PullToRefresh";
import EmployeeDashboard from "../../dashboard/ui/EmployeeDashboard";
import { defaultLocale } from "@/i18n/routing";

export default async function EmployeeDashboardPage({
  params,
}: {
  params: Promise<{ locale: string; publicId: string }>;
}) {
  const prisma = getPrisma();
  const { locale, publicId } = await params;
  const t = await getTranslations("portal.dashboard");
  const employee = await prisma.employee.findUnique({
    where: { publicId },
    select: { id: true, locale: true },
  });
  if (!employee) notFound();
  const employeeLocale = employee.locale || defaultLocale;
  if (employeeLocale !== locale) {
    return redirect(`/${employeeLocale}/portal/${publicId}/dashboard`);
  }

  const user = await getCurrentUser();
  if (!user || user.role !== "EMPLOYEE" || user.employeeId !== employee.id) {
    return (
      <div className="mx-auto max-w-md px-6 py-16">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {t("signinPrompt")}
        </p>
        <div className="mt-6">
          <Link
            className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
            href={`/${locale}/portal/${publicId}`}
          >
            {t("loginLink")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PullToRefresh>
      <div className="flex flex-col gap-4">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          {t("intro")}
        </div>
        <EmployeeDashboard publicId={publicId} locale={locale} />
      </div>
    </PullToRefresh>
  );
}
