import Link from "next/link";
import { notFound } from "next/navigation";
import { getPrisma } from "@/server/db/prisma";

function Tile(props: { href: string; title: string; desc: string }) {
  return (
    <Link
      href={props.href}
      className="rounded-xl border border-black/10 bg-white p-4 hover:bg-black/5 dark:border-white/10 dark:bg-zinc-950 dark:hover:bg-white/5"
    >
      <div className="text-sm font-semibold">{props.title}</div>
      <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{props.desc}</div>
    </Link>
  );
}

export default async function EmployeeAccountingHub({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const prisma = getPrisma();
  const { locale, id } = await params;
  const employee = await prisma.employee.findUnique({
    where: { id },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!employee) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            Accounting • {employee.firstName} {employee.lastName}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Everything you need in one place: attendance, deductions, debt, and pay periods.
          </p>
        </div>
        <Link
          className="rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-black/5 dark:text-zinc-200 dark:hover:bg-white/10"
          href={`/${locale}/admin/employees/${employee.id}`}
        >
          Back
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Tile
          href={`/${locale}/admin/employees/${employee.id}/attendance`}
          title="Attendance"
          desc="Mark days worked + authorized extra; weekends/holidays highlighted."
        />
        <Tile
          href={`/${locale}/admin/employees/${employee.id}/expenses`}
          title="Card expenses"
          desc="Enter purchases to deduct from the pay period."
        />
        <Tile
          href={`/${locale}/admin/employees/${employee.id}/debt`}
          title="Debt ledger"
          desc="Loans given and debt collected (balance is automatic)."
        />
        <Tile
          href={`/${locale}/admin/employees/${employee.id}/pay-periods`}
          title="Pay periods"
          desc="Generate/refresh weekly or monthly payroll totals and view details."
        />
      </div>
    </div>
  );
}

