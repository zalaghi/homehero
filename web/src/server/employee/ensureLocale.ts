import { redirect } from "next/navigation";
import { getPrisma } from "@/server/db/prisma";
import { defaultLocale } from "@/i18n/routing";

export async function ensureEmployeeLocale(
  publicId: string,
  currentLocale: string,
  pathSuffix: string,
) {
  const prisma = getPrisma();
  const employee = await prisma.employee.findUnique({
    where: { publicId },
    select: { id: true, locale: true },
  });
  if (!employee) return null;

  const targetLocale = employee.locale || defaultLocale;
  if (targetLocale !== currentLocale) {
    redirect(`/${targetLocale}/portal/${publicId}${pathSuffix}`);
  }

  return employee;
}
