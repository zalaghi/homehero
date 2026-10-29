import Link from "next/link";
import { notFound } from "next/navigation";
import { getPrisma } from "@/server/db/prisma";
import CardExpensesPanel from "./ui/CardExpensesPanel";

export default async function EmployeeExpensesPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const prisma = getPrisma();
  const { locale, id } = await params;

  const employee = await prisma.employee.findUnique({
    where: { id },
    select: { id: true, firstName: true, lastName: true, currency: true },
  });
  if (!employee) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            Card expenses • {employee.firstName} {employee.lastName}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Expenses are deducted from the pay period (Excel “Tarjeta”).
          </p>
        </div>
        <Link
          className="rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-black/5 dark:text-zinc-200 dark:hover:bg-white/10"
          href={`/${locale}/admin/employees/${employee.id}`}
        >
          Back
        </Link>
      </div>

      <CardExpensesPanel employeeId={employee.id} currency={employee.currency} />
    </div>
  );
}

