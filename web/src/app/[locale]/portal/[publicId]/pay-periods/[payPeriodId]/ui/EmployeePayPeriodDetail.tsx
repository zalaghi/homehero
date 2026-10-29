"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import PdfPreviewDialog from "@/components/PdfPreviewDialog";

type PeriodDetail = {
  period: {
    id: string;
    startDate: string;
    endDate: string;
    status: string;
    paidAt: string | null;
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

export default function EmployeePayPeriodDetail(props: { payPeriodId: string }) {
  const pdfLabel = useTranslations("portal.pdfViewer");
  const [pdfOpen, setPdfOpen] = useState(false);
  const t = useTranslations("portal.payPeriodDetail");
  const tStatus = useTranslations("portal.payPeriods.status");
  const [data, setData] = useState<PeriodDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/employee/pay-periods/${props.payPeriodId}`, { credentials: "include" });
      const json = (await res.json().catch(() => null)) as PeriodDetail | { error?: string } | null;
      if (!res.ok || !json || "error" in json) {
        setError(t("errors.load"));
        return;
      }
      setData(json as PeriodDetail);
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

  const validWorkedCount = useMemo(
    () => data?.attendance.filter((a) => a.validWorkedDay).length ?? 0,
    [data],
  );

  const statusLabel = useMemo(() => {
    const rawStatus = data?.period.status ?? "";
    const key = rawStatus.toLowerCase();
    if (key === "draft" || key === "final" || key === "paid") {
      return tStatus(key);
    }
    return rawStatus;
  }, [data, tStatus]);

  if (loading && !data) return <div className="text-sm text-zinc-500">{t("loading")}</div>;
  if (error && !data) return <div className="text-sm text-red-600">{error}</div>;
  if (!data) return null;

  return (
    <div className="flex flex-col gap-4">
      <div><button type="button" className="inline-flex rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white" onClick={() => setPdfOpen(true)}>{pdfLabel("open")}</button></div>
      {pdfOpen && <PdfPreviewDialog src={`/api/employee/pay-periods/${props.payPeriodId}/pdf`} onClose={() => setPdfOpen(false)} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">{t("period")}</div>
          <div className="mt-1 font-mono text-sm">
            {data.period.startDate} → {data.period.endDate}
          </div>
          <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            {t("status", { status: statusLabel })}
          </div>

        </div>
        <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">{t("netPay")}</div>
          <div className="mt-1 text-2xl font-semibold">{s ? fmtMoney(s.netPayCents, currency) : "-"}</div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {t("validDays", { count: s?.validDays ?? validWorkedCount })}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
        <div className="border-b border-black/10 px-3 py-2 text-sm font-semibold dark:border-white/10">
          {t("breakdown")}
        </div>
        <div className="p-3 text-sm">
          <div>{t("gross", { amount: s ? fmtMoney(s.grossPayCents, currency) : "-" })}</div>
          <div>{t("expenses", { amount: s ? fmtMoney(s.cardExpensesCents, currency) : "-" })}</div>
          <div>{t("debtCollected", { amount: s ? fmtMoney(s.debtCollectedCents, currency) : "-" })}</div>
          <div>{t("loans", { amount: s ? fmtMoney(s.loansCents, currency) : "-" })}</div>
        </div>
      </div>
    </div>
  );
}
