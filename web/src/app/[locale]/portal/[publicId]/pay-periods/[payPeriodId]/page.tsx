import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPrisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";
import EmployeePayPeriodDetail from "./ui/EmployeePayPeriodDetail";

export default async function EmployeePayPeriodDetailPage({
  params,
}: {
  params: Promise<{ locale: string; publicId: string; payPeriodId: string }>;
}) {
  const prisma = getPrisma();
  const { locale, publicId, payPeriodId } = await params;
  const t = await getTranslations("portal.payPeriodDetailPage");
  const employee = await prisma.employee.findUnique({
    where: { publicId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!employee) notFound();

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
    <div className="mx-auto max-w-md px-6 py-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {t("heading", { name: `${employee.firstName} ${employee.lastName}` })}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {t("subtitle")}
          </p>
        </div>
        <Link
          className="rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-black/5 dark:text-zinc-200 dark:hover:bg-white/10"
          href={`/${locale}/portal/${publicId}/pay-periods`}
        >
          {t("back")}
        </Link>
      </div>

      <div className="mt-6">
        <EmployeePayPeriodDetail payPeriodId={payPeriodId} />
      </div>
    </div>
  );
}
