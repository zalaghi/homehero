"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

type Item = { id: string; date: string; concept: string; amountCents: number; currency: string };

function money(cents: number, currency: string) {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}

export default function CardExpensesPanel(props: { employeeId: string; currency: string }) {
  const t = useTranslations("admin.cardExpensesPanel");
  const tCommon = useTranslations("common");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState("");

  const amountCents = useMemo(() => {
    const n = Number(amount.replace(",", "."));
    if (!Number.isFinite(n)) return NaN;
    return Math.round(n * 100);
  }, [amount]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/employees/${props.employeeId}/card-expenses`, {
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

  async function create() {
    setError(null);
    if (!concept.trim() || !Number.isFinite(amountCents) || amountCents <= 0) {
      setError(t("errors.validation"));
      return;
    }
    const res = await fetch(`/api/admin/employees/${props.employeeId}/card-expenses`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        date,
        concept,
        amountCents,
        currency: props.currency,
      }),
    });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setError(t("errors.create"));
      return;
    }
    setConcept("");
    setAmount("");
    await load();
  }

  async function remove(id: string) {
    setError(null);
    const res = await fetch(
      `/api/admin/employees/${props.employeeId}/card-expenses/${id}`,
      { method: "DELETE", credentials: "include" },
    );
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setError(t("errors.delete"));
      return;
    }
    await load();
  }

  const total = items.reduce((s, i) => s + i.amountCents, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950">
        <div className="text-sm font-semibold">{t("addExpense")}</div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t("fields.date")}</span>
            <input
              type="date"
              className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-sm font-medium">{t("fields.concept")}</span>
            <input
              className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder={t("placeholders.concept")}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t("fields.amount", { currency: props.currency })}</span>
            <input
              className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder={t("placeholders.amount")}
            />
          </label>
          <div className="flex items-end">
            <button
              className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              disabled={loading}
              onClick={() => void create()}
            >
              {t("actions.add")}
            </button>
          </div>
        </div>
        {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b border-black/10 px-3 py-2 text-sm dark:border-white/10">
          <div className="font-semibold">{t("recentExpenses")}</div>
          <div className="text-zinc-600 dark:text-zinc-400">
            {t("total", { amount: money(total, props.currency) })}
          </div>
        </div>
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-black/5 text-left dark:bg-white/10">
            <tr>
              <th className="px-3 py-2 font-medium">{t("table.date")}</th>
              <th className="px-3 py-2 font-medium">{t("table.concept")}</th>
              <th className="px-3 py-2 font-medium">{t("table.amount")}</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id} className="border-t border-black/10 dark:border-white/10">
                <td className="px-3 py-2 font-mono">{e.date}</td>
                <td className="px-3 py-2">{e.concept}</td>
                <td className="px-3 py-2">{money(e.amountCents, e.currency)}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    className="rounded-md px-3 py-2 text-sm text-red-700 hover:bg-red-500/10 dark:text-red-300"
                    onClick={() => void remove(e.id)}
                  >
                    {t("actions.delete")}
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-zinc-500" colSpan={4}>
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
