import Link from "next/link";
import { notFound } from "next/navigation";
import { getPrisma } from "@/server/db/prisma";
import PayPeriodDetail from "./ui/PayPeriodDetail";

export default async function PayPeriodDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string; payPeriodId: string }>;
}) {
  const prisma = getPrisma();
  const { locale, id: employeeId, payPeriodId } = await params;

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!employee) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            Pay period details • {employee.firstName} {employee.lastName}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Clear breakdown like Excel “Recibo”: attendance, deductions, debt movements, net pay.
          </p>
        </div>
        <Link
          className="rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-black/5 dark:text-zinc-200 dark:hover:bg-white/10"
          href={`/${locale}/admin/employees/${employeeId}/pay-periods`}
        >
          Back
        </Link>
      </div>

      <PayPeriodDetail payPeriodId={payPeriodId} />
    </div>
  );
}

