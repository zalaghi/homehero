import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPrisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";
import { defaultLocale } from "@/i18n/routing";
import PortalEntryForm from "./ui/PortalEntryForm";

export default async function PortalRoot({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("portal.root");
  const user = await getCurrentUser();
  // Recover admin installations made with the former shared employee manifest.
  if (user?.role === "ADMIN") redirect(`/${locale}/admin`);
  if (user?.role === "EMPLOYEE" && user.employeeId) {
    const prisma = getPrisma();
    const employee = await prisma.employee.findUnique({
      where: { id: user.employeeId },
      select: { publicId: true, locale: true },
    });
    if (employee) {
      const employeeLocale = employee.locale || defaultLocale;
      redirect(`/${employeeLocale}/portal/${employee.publicId}/dashboard`);
    }
  }

  return (
    <div className="min-h-[100dvh] min-h-[100vh] overscroll-y-none bg-zinc-50 px-6 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+3rem+1px)] text-zinc-950 dark:bg-black dark:text-zinc-50">
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{t("subtitle")}</p>
        <PortalEntryForm locale={locale} />
        <div className="mt-6 rounded-lg border border-black/10 bg-white p-3 text-sm dark:border-white/10 dark:bg-zinc-950">
          <div className="font-medium">{t("tipTitle")}</div>
          <div className="mt-1 text-zinc-600 dark:text-zinc-400">{t("tipBody")}</div>
        </div>
      </div>
    </div>
  );
}
