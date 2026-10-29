import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getUnifiConfigSummary } from "@/server/unifi/config";
import { getPrisma } from "@/server/db/prisma";
import UnifiSettingsForm from "./ui/UnifiSettingsForm";

export default async function UnifiSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("admin.unifi");
  const summary = await getUnifiConfigSummary();
  const db=getPrisma();
  const [employees,suggestions]=await Promise.all([db.employee.findMany({select:{id:true,firstName:true,lastName:true}}),db.protectAttendanceSuggestion.findMany({where:{status:"PENDING"},include:{employee:{select:{firstName:true,lastName:true}}},orderBy:{createdAt:"desc"},take:50})]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {t("subtitle")}
          </p>
        </div>
        <Link
          className="rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-black/5 dark:text-zinc-200 dark:hover:bg-white/10"
          href={`/${locale}/admin`}
        >
          {t("back")}
        </Link>
      </div>

      <div className="w-full">
        <UnifiSettingsForm initial={summary} employees={employees.map(e=>({id:e.id,name:`${e.firstName} ${e.lastName}`}))} suggestions={suggestions.map(s=>({id:s.id,employeeId:s.employeeId,employeeName:`${s.employee.firstName} ${s.employee.lastName}`,date:s.date.toISOString().slice(0,10),personName:s.personName,cameraName:s.cameraName,seenAt:s.seenAt.toISOString()}))} locale={locale} />
      </div>
    </div>
  );
}
