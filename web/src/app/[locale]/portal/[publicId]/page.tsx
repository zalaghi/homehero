import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPrisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";
import EmployeeLogin from "./ui/EmployeeLogin";
import { maskEmail } from "@/lib/email";
import { defaultLocale } from "@/i18n/routing";

export default async function PortalEntry({
  params,
}: {
  params: Promise<{ locale: string; publicId: string }>;
}) {
  const { locale, publicId } = await params;
  const t = await getTranslations("portal.login");
  const prisma = getPrisma();
  const employee = await prisma.employee.findUnique({
    where: { publicId },
    select: { id: true, firstName: true, lastName: true, email: true, locale: true },
  });
  if (!employee) notFound();
  const employeeLocale = employee.locale || defaultLocale;
  if (employeeLocale !== locale) {
    redirect(`/${employeeLocale}/portal/${publicId}`);
  }

  const user = await getCurrentUser();
  if (user?.role === "EMPLOYEE" && user.employeeId === employee.id) {
    redirect(`/${locale}/portal/${publicId}/dashboard`);
  }

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {t("subtitle")}
      </p>
      <div className="mt-3 rounded-lg border border-black/10 bg-white p-3 text-sm dark:border-white/10 dark:bg-zinc-950">
        <div className="font-medium">
          {employee.firstName} {employee.lastName}
        </div>
        <div className="text-zinc-600 dark:text-zinc-400">
          {t("emailOnFile", {
            email: employee.email ? maskEmail(employee.email) : t("emailMissing"),
          })}
        </div>
      </div>
      <div className="mt-6">
        <EmployeeLogin employeePublicId={publicId} prefillEmail={employee.email ?? undefined} />
      </div>
    </div>
  );
}
