import { getTranslations } from "next-intl/server";
import { getPrisma } from "@/server/db/prisma";
import AdminAbsenceList from "./ui/AdminAbsenceList";

export default async function AdminAbsencesPage() {
  const t = await getTranslations("admin.absences");
  const prisma = getPrisma();
  const absences = await prisma.absence.findMany({
    orderBy: [{ startDate: "desc" }],
    include: { employee: { select: { firstName: true, lastName: true, publicId: true } } },
  });

  const employees = Array.from(
    new Map(
      absences.map((absence) => [
        absence.employeeId,
        {
          id: absence.employeeId,
          name: `${absence.employee.firstName} ${absence.employee.lastName}`,
        },
      ])
    ).values()
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {t("subtitle")}
        </p>
      </div>

      <AdminAbsenceList
        todayIso={new Date().toISOString().slice(0, 10)}
        absences={absences.map((absence) => ({
          id: absence.id,
          employeeId: absence.employeeId,
          employeeName: `${absence.employee.firstName} ${absence.employee.lastName}`,
          employeePublicId: absence.employee.publicId,
          startDate: absence.startDate.toISOString().slice(0, 10),
          endDate: absence.endDate.toISOString().slice(0, 10),
          reason: absence.reason ?? null,
        }))}
        employees={employees}
      />
    </div>
  );
}
