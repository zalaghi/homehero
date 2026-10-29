"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

type Item = {
  id: string;
  frequency: string;
  startDate: string;
  endDate: string;
  status: string;
  validDays: number;
  grossPayCents: number;
  cardExpensesCents: number;
  loansCents: number;
  debtCollectedCents: number;
  netPayCents: number;
  currency: string;
  paidAt: string | null;
};

function frequencyLabel(frequency: string, t: (key: string) => string) {
  if (frequency === "WEEKLY_ISO") return t("frequency.weekly");
  if (frequency === "MONTHLY") return t("frequency.monthly");
  return frequency;
}

function statusLabel(status: string, t: (key: string) => string) {
  if (status === "PAID") return t("status.paid");
  if (status === "FINAL") return t("status.final");
  if (status === "DRAFT") return t("status.draft");
  return status;
}

function money(locale: string, cents: number, currency: string) {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export default function EmployeePayPeriods(props: { currency: string }) {
  void props;
  const locale = useLocale();
  const t = useTranslations("portal.payPeriods");
  const tCommon = useTranslations("common");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/employee/pay-periods", { credentials: "include" });
      const data = (await res.json().catch(() => null)) as { items?: Item[]; error?: string } | null;
      if (!res.ok || !data?.items) {
        setError(data?.error ?? t("errors.load"));
        return;
      }
      setItems(data.items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- This effect synchronizes the remote resource and its loading state.
    void load();
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <div className="flex flex-col gap-3 sm:hidden">
        {items.map((p) => (
          <button
            key={p.id}
            className="rounded-xl border border-black/10 bg-white p-4 text-left shadow-sm dark:border-white/10 dark:bg-zinc-950"
            onClick={() => {
              window.location.href = `${window.location.pathname}/${p.id}`;
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">{frequencyLabel(p.frequency, t)}</div>
                <div className="mt-1 font-mono text-xs">
                  {p.startDate} → {p.endDate}
                </div>
              </div>
              <span className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {p.status}
              </span>
            </div>
            <div className="mt-3 text-2xl font-semibold">{money(locale, p.netPayCents, p.currency)}</div>
            <div className="mt-1 text-xs text-zinc-500">
              {t("summaryDays", {
                count: p.validDays,
                gross: money(locale, p.grossPayCents, p.currency),
              })}
            </div>
          </button>
        ))}
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/10 bg-white p-6 text-center text-sm text-zinc-500 dark:border-white/10 dark:bg-zinc-950">
            {loading ? tCommon("loading") : t("empty")}
          </div>
        ) : null}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950 sm:block">
        <table className="w-full text-sm">
          <thead className="bg-black/5 text-left dark:bg-white/10">
            <tr>
              <th className="px-3 py-2 font-medium">{t("table.period")}</th>
              <th className="px-3 py-2 font-medium">{t("table.net")}</th>
              <th className="px-3 py-2 font-medium">{t("table.status")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr
                key={p.id}
                className="cursor-pointer border-t border-black/10 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
                onClick={() => {
                  window.location.href = `${window.location.pathname}/${p.id}`;
                }}
              >
                <td className="px-3 py-2">
                  <div className="font-mono text-xs">
                    {p.startDate} → {p.endDate}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">{frequencyLabel(p.frequency, t)}</div>
                  <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    {t("table.summary", {
                      validDays: p.validDays,
                      gross: money(locale, p.grossPayCents, p.currency),
                      expenses: money(locale, p.cardExpensesCents, p.currency),
                    })}
                  </div>
                </td>
                <td className="px-3 py-2 font-medium">{money(locale, p.netPayCents, p.currency)}</td>
                <td className="px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400">
                  {statusLabel(p.status, t)}
                  {p.paidAt ? ` • ${t("table.paid")}` : ""}
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-zinc-500" colSpan={3}>
                  {loading ? tCommon("loading") : t("empty")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
