"use client";

import DeleteButton from "@/components/DeleteButton";
import Link from "next/link";
import { useLocale } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

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
};

function money(cents: number, currency: string) {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}

export default function PayPeriodsPanel(props: { employeeId: string; currency: string }) {
  const locale = useLocale();
  const a = useTranslations("admin.actions");
  const t = useTranslations("admin.payPeriodsPanel");
  const tCommon = useTranslations("common");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [anchorDate, setAnchorDate] = useState(() => new Date().toISOString().slice(0, 10));

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/employees/${props.employeeId}/pay-periods`, {
        credentials: "include",
      });
      const data = (await res.json().catch(() => null)) as { items?: Item[]; error?: string } | null;
      if (!res.ok || !data?.items) {
        setError(t("errors.load"));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.employeeId]);

  async function generate() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/employees/${props.employeeId}/pay-periods/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ anchorDate }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(t("errors.generate"));
        return;
      }
      await load();
    } finally {
      setLoading(false);
    }
  }

  const totalNet = useMemo(() => items.reduce((s, p) => s + p.netPayCents, 0), [items]);
  const formatFrequency = (value: string) => {
    if (value === "WEEKLY_ISO") return t("frequency.weekly");
    if (value === "MONTHLY") return t("frequency.monthly");
    return value;
  };
  const formatStatus = (value: string) => {
    const key = value.toLowerCase();
    if (key === "draft" || key === "final" || key === "paid") {
      return t(`status.${key}`);
    }
    return value;
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950">
        <div className="text-sm font-semibold">{t("generateTitle")}</div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t("anchorDate")}</span>
            <input
              type="date"
              className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
              value={anchorDate}
              onChange={(e) => setAnchorDate(e.target.value)}
            />
          </label>
          <button
            className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            disabled={loading}
            onClick={() => void generate()}
          >
            {loading ? tCommon("running") : t("generateAction")}
          </button>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {t("tip")}
          </div>
        </div>
        {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b border-black/10 px-3 py-2 text-sm dark:border-white/10">
          <div className="font-semibold">{t("recentPeriods")}</div>
          <div className="text-zinc-600 dark:text-zinc-400">
            {t("totalNet", { amount: money(totalNet, props.currency) })}
          </div>
        </div>
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-black/5 text-left dark:bg-white/10">
            <tr>
              <th className="px-3 py-2 font-medium">{t("table.period")}</th>
              <th className="px-3 py-2 font-medium">{t("table.validDays")}</th>
              <th className="px-3 py-2 font-medium">{t("table.gross")}</th>
              <th className="px-3 py-2 font-medium">{t("table.expenses")}</th>
              <th className="px-3 py-2 font-medium">{t("table.debtDelta")}</th>
              <th className="px-3 py-2 font-medium">{t("table.net")}</th>
              <th className="px-3 py-2 font-medium">{t("table.status")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr
                key={p.id}
                className="cursor-pointer border-t border-black/10 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
              >
                <td className="px-3 py-2">
                  <Link className="font-mono text-xs font-semibold underline" href={`/${locale}/admin/employees/${props.employeeId}/pay-periods/${p.id}`}>{p.startDate} → {p.endDate}</Link>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">{formatFrequency(p.frequency)}</div>
                </td>
                <td className="px-3 py-2">{p.validDays}</td>
                <td className="px-3 py-2">{money(p.grossPayCents, p.currency)}</td>
                <td className="px-3 py-2">-{money(p.cardExpensesCents, p.currency)}</td>
                <td className="px-3 py-2 text-xs">
                  +{money(p.loansCents, p.currency)} / -{money(p.debtCollectedCents, p.currency)}
                </td>
                <td className="px-3 py-2 font-medium">{money(p.netPayCents, p.currency)}</td>
                <td className="px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400">{formatStatus(p.status)}{p.status === "DRAFT" && <div className="mt-2"><DeleteButton url={`/api/admin/pay-periods/${p.id}`} name={`${a("draft")}: ${p.startDate} → ${p.endDate}`} onDeleted={load} /></div>}</td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-zinc-500" colSpan={7}>
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
