"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

type PeriodDetail = {
  period: {
    id: string;
    startDate: string;
    endDate: string;
    status: string;
    paidAt: string | null;
    adminNote: string | null;
    receiptDownloadUrl?: string | null;
    employee: { firstName: string; lastName: string; currency: string; timezone: string };
    snapshots: {
      validDays: number;
      dailyRateCents: number;
      grossPayCents: number;
      cardExpensesCents: number;
      loansCents: number;
      debtCollectedCents: number;
      debtStartCents: number;
      debtEndCents: number;
      netPayCents: number;
      currency: string;
    };
  };
  attendance: Array<{
    date: string;
    worked: boolean;
    authorizedExtra: boolean;
    validWorkedDay: boolean;
    isHoliday: boolean;
    isWeekend: boolean;
  }>;
  cardExpenses: Array<{ date: string; concept: string; amountCents: number; currency: string }>;
  debtTransactions: Array<{ id: string; date: string; type: string; amountCents: number; currency: string; note: string | null }>;
};

function fmtMoney(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export default function PayPeriodDetail(props: { payPeriodId: string }) {
  const t = useTranslations("admin.payPeriodDetail");
  const tCommon = useTranslations("common");
  const pdfLabel = useTranslations("admin.weeklyEmail");
  const [data, setData] = useState<PeriodDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string>("DRAFT");
  const [adminNote, setAdminNote] = useState<string>("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pay-periods/${props.payPeriodId}`, { credentials: "include" });
      const json = (await res.json().catch(() => null)) as PeriodDetail | { error?: string } | null;
      if (!res.ok || !json || "error" in json) {
        setError(t("errors.load"));
        return;
      }
      setData(json as PeriodDetail);
      setStatus((json as PeriodDetail).period.status);
      setAdminNote((json as PeriodDetail).period.adminNote ?? "");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- This effect synchronizes the remote resource and its loading state.
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.payPeriodId]);

  const currency = data?.period.snapshots.currency ?? "EUR";
  const s = data?.period.snapshots;

  const validWorkedCount = useMemo(() => data?.attendance.filter((a) => a.validWorkedDay).length ?? 0, [data]);

  async function markPaid() {
    if (!data) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pay-periods/${props.payPeriodId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "PAID", paidAt: new Date().toISOString(), adminNote }),
      });
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(t("errors.markPaid"));
        return;
      }
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function saveStatusAndNote() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pay-periods/${props.payPeriodId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status, adminNote }),
      });
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(t("errors.save"));
        return;
      }
      await load();
    } finally {
      setSaving(false);
    }
  }

  const statusKey = (value: string) => {
    const key = value.toLowerCase();
    if (key === "draft" || key === "final" || key === "paid") return key;
    return value;
  };
  const statusLabel = (value: string) => {
    const key = statusKey(value);
    if (key === "draft" || key === "final" || key === "paid") {
      return t(`status.${key}`);
    }
    return value;
  };
  const debtTypeLabel = (value: string) => {
    if (value === "LOAN_GIVEN") return t("debtTable.types.loanGiven");
    if (value === "DEBT_COLLECTED") return t("debtTable.types.debtCollected");
    return value;
  };

  if (loading && !data) return <div className="text-sm text-zinc-500">{tCommon("loading")}</div>;
  if (error && !data) return <div className="text-sm text-red-600">{error}</div>;
  if (!data) return null;

  return (
    <div className="flex flex-col gap-4">
      <div><a className="inline-flex rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white" href={`/api/admin/pay-periods/${props.payPeriodId}/pdf`}>{pdfLabel("download")}</a></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">{t("summary.period")}</div>
          <div className="mt-1 font-mono text-sm">
            {data.period.startDate} → {data.period.endDate}
          </div>
          <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            {t("summary.status", { status: statusLabel(data.period.status) })}
          </div>
        </div>
        <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">{t("summary.validDays")}</div>
          <div className="mt-1 text-2xl font-semibold">{s?.validDays ?? validWorkedCount}</div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {t("summary.dailyRate", { amount: s ? fmtMoney(s.dailyRateCents, currency) : "-" })}
          </div>
        </div>
        <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">{t("summary.gross")}</div>
          <div className="mt-1 text-2xl font-semibold">{s ? fmtMoney(s.grossPayCents, currency) : "-"}</div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {t("summary.expenses", { amount: s ? fmtMoney(s.cardExpensesCents, currency) : "-" })}
          </div>
        </div>
        <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">{t("summary.netPay")}</div>
          <div className="mt-1 text-2xl font-semibold">{s ? fmtMoney(s.netPayCents, currency) : "-"}</div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {t("summary.debt", {
              start: s ? fmtMoney(s.debtStartCents, currency) : "-",
              end: s ? fmtMoney(s.debtEndCents, currency) : "-",
            })}
          </div>
        </div>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          disabled={saving}
          className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          onClick={() => void markPaid()}
        >
          {saving ? tCommon("saving") : t("actions.markPaid")}
        </button>
        <button
          disabled={saving}
          className="rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-black/5 dark:text-zinc-200 dark:hover:bg-white/10"
          onClick={() => void load()}
        >
          {t("actions.refresh")}
        </button>
        <button
          disabled={saving}
          className="rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-black/5 dark:text-zinc-200 dark:hover:bg-white/10"
          onClick={() => void saveStatusAndNote()}
        >
          {t("actions.save")}
        </button>

      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950">
          <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{t("statusSection.title")}</div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-2 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
            disabled={saving}
          >
            <option value="DRAFT">{t("status.draft")}</option>
            <option value="FINAL">{t("status.final")}</option>
            <option value="PAID">{t("status.paid")}</option>
          </select>
          <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
            {t("statusSection.paidAt", { date: data.period.paidAt ?? "-" })}
          </div>
        </div>
        <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950">
          <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{t("note.title")}</div>
          <textarea
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            rows={3}
            className="mt-2 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
            placeholder={t("note.placeholder")}
            disabled={saving}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="overflow-x-auto rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
          <div className="border-b border-black/10 px-3 py-2 text-sm font-semibold dark:border-white/10">
            {t("sections.attendance")}
          </div>
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-black/5 text-left dark:bg-white/10">
              <tr>
                <th className="px-3 py-2 font-medium">{t("attendanceTable.date")}</th>
                <th className="px-3 py-2 font-medium">{t("attendanceTable.worked")}</th>
                <th className="px-3 py-2 font-medium">{t("attendanceTable.valid")}</th>
              </tr>
            </thead>
            <tbody>
              {data.attendance.map((a) => (
                <tr key={a.date} className="border-t border-black/10 dark:border-white/10">
                  <td className="px-3 py-2 font-mono text-xs">{a.date}</td>
                  <td className="px-3 py-2 text-xs">
                    {a.worked ? tCommon("yes") : tCommon("no")}
                    {a.isHoliday ? ` • ${t("attendanceFlags.holiday")}` : ""}
                    {a.isWeekend ? ` • ${t("attendanceFlags.weekend")}` : ""}
                    {a.authorizedExtra ? ` • ${t("attendanceFlags.extra")}` : ""}
                  </td>
                  <td className="px-3 py-2 text-xs">{a.validWorkedDay ? tCommon("yes") : tCommon("no")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
          <div className="border-b border-black/10 px-3 py-2 text-sm font-semibold dark:border-white/10">
            {t("sections.cardExpenses")}
          </div>
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-black/5 text-left dark:bg-white/10">
              <tr>
                <th className="px-3 py-2 font-medium">{t("cardExpensesTable.date")}</th>
                <th className="px-3 py-2 font-medium">{t("cardExpensesTable.concept")}</th>
                <th className="px-3 py-2 font-medium">{t("cardExpensesTable.amount")}</th>
              </tr>
            </thead>
            <tbody>
              {data.cardExpenses.map((e) => (
                <tr key={`${e.date}-${e.concept}`} className="border-t border-black/10 dark:border-white/10">
                  <td className="px-3 py-2 font-mono text-xs">{e.date}</td>
                  <td className="px-3 py-2 text-xs">{e.concept}</td>
                  <td className="px-3 py-2 text-xs">{fmtMoney(e.amountCents, e.currency)}</td>
                </tr>
              ))}
              {data.cardExpenses.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-zinc-500" colSpan={3}>
                    {t("empty")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
          <div className="border-b border-black/10 px-3 py-2 text-sm font-semibold dark:border-white/10">
            {t("sections.debtLedger")}
          </div>
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-black/5 text-left dark:bg-white/10">
              <tr>
                <th className="px-3 py-2 font-medium">{t("debtTable.date")}</th>
                <th className="px-3 py-2 font-medium">{t("debtTable.type")}</th>
                <th className="px-3 py-2 font-medium">{t("debtTable.amount")}</th>
              </tr>
            </thead>
            <tbody>
              {data.debtTransactions.map((t) => (
                <tr key={`${t.date}-${t.id}`} className="border-t border-black/10 dark:border-white/10">
                  <td className="px-3 py-2 font-mono text-xs">{t.date}</td>
                  <td className="px-3 py-2 text-xs">{debtTypeLabel(t.type)}</td>
                  <td className="px-3 py-2 text-xs">{fmtMoney(t.amountCents, t.currency)}</td>
                </tr>
              ))}
              {data.debtTransactions.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-zinc-500" colSpan={3}>
                    {t("empty")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
