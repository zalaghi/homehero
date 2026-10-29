"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

type EmployeeRow = {
  id: string;
  publicId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  payFrequency: string;
  attendanceSource: string;
  dailyRateCents: number;
  currency: string;
  holidayCalendarName: string | null;
};

type Props = {
  locale: string;
  employees: EmployeeRow[];
};

function formatMoney(locale: string, cents: number, currency: string) {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
  } catch {
    const amount = (cents / 100).toFixed(2);
    return `${amount} ${currency}`;
  }
}

export default function EmployeeTable({ locale, employees }: Props) {
  const t = useTranslations("admin.employeesTable");
  const localeCode = useLocale();
  const [query, setQuery] = useState("");

  function payFrequencyLabel(value: string) {
    if (value === "WEEKLY_ISO") return t("payFrequency.weekly");
    if (value === "MONTHLY") return t("payFrequency.monthly");
    return value;
  }

  function attendanceSourceLabel(value: string) {
    if (value === "HYBRID") return t("attendanceSource.hybrid");
    if (value === "MANUAL") return t("attendanceSource.manual");
    if (value === "UNIFI") return t("attendanceSource.unifi");
    return value;
  }
  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return employees;
    return employees.filter((employee) => {
      const name = `${employee.firstName} ${employee.lastName}`.toLowerCase();
      const email = employee.email?.toLowerCase() ?? "";
      return name.includes(trimmed) || email.includes(trimmed);
    });
  }, [employees, query]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-zinc-950">
        <div>
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400" htmlFor="employee-search">
            {t("searchLabel")}
          </label>
          <input
            id="employee-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="mt-1 w-64 rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus-visible:ring-2 focus-visible:ring-zinc-900/20 dark:border-white/10 dark:bg-black dark:text-zinc-100 dark:focus-visible:ring-white/30"
          />
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          {t("count", { filtered: filtered.length, total: employees.length })}
        </div>
      </div>

      <div className="grid gap-3 md:hidden">{filtered.map(employee => <article key={employee.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-semibold">{employee.firstName} {employee.lastName}</h2>
        <p className="mt-1 break-all text-sm text-zinc-500">{employee.email}</p>
        <p className="mt-3 text-lg font-semibold">{formatMoney(localeCode, employee.dailyRateCents, employee.currency)}</p>
        <p className="text-xs text-zinc-500">{payFrequencyLabel(employee.payFrequency)} · {attendanceSourceLabel(employee.attendanceSource)}</p>
        <p className="mt-2 text-sm">{employee.holidayCalendarName ?? t("none")}</p>
        <div className="mt-4 flex flex-wrap gap-2"><Link className="rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white" href={`/${locale}/admin/employees/${employee.id}`}>{t("actions.manage")}</Link><Link className="rounded-lg border px-4 py-3 text-sm" href={`/${locale}/portal/${employee.publicId}`}>{t("actions.portalLink")}</Link></div>
      </article>)}</div>
      <div className="hidden overflow-x-auto rounded-xl md:block border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-black/5 text-left dark:bg-white/10">
            <tr>
              <th className="px-4 py-3 font-medium">{t("columns.name")}</th>
              <th className="px-4 py-3 font-medium">{t("columns.pay")}</th>
              <th className="px-4 py-3 font-medium">{t("columns.calendar")}</th>
              <th className="px-4 py-3 font-medium text-right">{t("columns.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((employee) => (
              <tr
                key={employee.id}
                className="border-t border-black/10 transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
              >
                <td className="px-4 py-3">
                  <Link
                    className="font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
                    href={`/${locale}/admin/employees/${employee.id}`}
                  >
                    {employee.firstName} {employee.lastName}
                  </Link>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {employee.email ?? t("noEmail")} • {payFrequencyLabel(employee.payFrequency)} •{" "}
                    {attendanceSourceLabel(employee.attendanceSource)}
                  </div>
                </td>
                <td className="px-4 py-3">{formatMoney(localeCode, employee.dailyRateCents, employee.currency)}</td>
                <td className="px-4 py-3">
                  {employee.holidayCalendarName ?? <span className="text-zinc-500">{t("none")}</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <Link
                      className="rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                      href={`/${locale}/admin/employees/${employee.id}`}
                    >
                      {t("actions.manage")}
                    </Link>
                    <Link
                      className="rounded-md border border-black/10 px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-black/5 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/10"
                      href={`/${locale}/portal/${employee.publicId}`}
                    >
                      {t("actions.portalLink")}
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm text-zinc-500" colSpan={4}>
                  {t("empty")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
