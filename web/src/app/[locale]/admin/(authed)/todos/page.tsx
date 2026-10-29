import { getTranslations } from "next-intl/server";
import { getPrisma } from "@/server/db/prisma";
import AdminTodoPanel from "./ui/AdminTodoPanel";

export default async function AdminTodosPage() {
  const t = await getTranslations("admin.todos");
  const prisma = getPrisma();
  const employees = await prisma.employee.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true, publicId: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {t("subtitle")}
        </p>
      </div>
      <AdminTodoPanel employees={employees} />
    </div>
  );
}
