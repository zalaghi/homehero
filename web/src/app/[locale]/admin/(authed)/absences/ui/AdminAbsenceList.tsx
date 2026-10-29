"use client";

import DeleteButton from "@/components/DeleteButton";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

type AbsenceItem = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeePublicId: string;
  startDate: string;
  endDate: string;
  reason: string | null;
};

type Props = {
  todayIso: string;
  absences: AbsenceItem[];
  employees: { id: string; name: string }[];
};

function isAwayNow(absence: AbsenceItem, todayIso: string) {
  return absence.startDate <= todayIso && absence.endDate >= todayIso;
}

export default function AdminAbsenceList({ todayIso, absences, employees }: Props) {
  const t = useTranslations("admin.absences");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const filtered = useMemo(() => {
    if (employeeFilter === "all") return absences;
    return absences.filter((absence) => absence.employeeId === employeeFilter);
  }, [absences, employeeFilter]);

  const awayNow = filtered.filter((absence) => isAwayNow(absence, todayIso));
  const upcoming = filtered.filter(
    (absence) => !isAwayNow(absence, todayIso) && absence.startDate > todayIso
  );

  return (
    <div className="flex flex-col gap-6">
      {employees.length > 1 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-black/10 bg-white px-4 py-3 dark:border-white/10 dark:bg-zinc-950">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400" htmlFor="absence-filter">
            {t("filter.label")}
          </label>
          <select
            id="absence-filter"
            value={employeeFilter}
            onChange={(event) => setEmployeeFilter(event.target.value)}
            className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus-visible:ring-2 focus-visible:ring-zinc-900/20 dark:border-white/10 dark:bg-black dark:text-zinc-100 dark:focus-visible:ring-white/30"
          >
            <option value="all">{t("filter.allEmployees")}</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <Section
        title={t("sections.awayNow.title")}
        emptyText={t("sections.awayNow.empty")}
        items={awayNow}
      />
      <Section
        title={t("sections.upcoming.title")}
        emptyText={t("sections.upcoming.empty")}
        items={upcoming}
      />
      <Section title={t("history")} emptyText={t("noHistory")} items={filtered.filter(a => a.endDate < todayIso)} />
    </div>
  );
}

function Section(props: { title: string; emptyText: string; items: AbsenceItem[] }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{props.title}</h2>
      <div className="flex flex-col gap-2">
        {props.items.map((absence) => (
          <div
            key={absence.id}
            className="rounded-xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-950"
          >
            <div className="text-sm font-semibold">
              {absence.employeeName} ({absence.employeePublicId})
            </div>
            <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
              {absence.startDate} → {absence.endDate}
            </div>
            <div className="mt-3"><DeleteButton url={`/api/admin/absences/${absence.id}`} name={`${absence.employeeName}: ${absence.startDate} → ${absence.endDate}`} /></div>
            {absence.reason ? (
              <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">
                {absence.reason}
              </div>
            ) : null}
          </div>
        ))}
        {props.items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/10 bg-white p-6 text-center text-sm text-zinc-500 dark:border-white/10 dark:bg-zinc-950">
            {props.emptyText}
          </div>
        ) : null}
      </div>
    </div>
  );
}
