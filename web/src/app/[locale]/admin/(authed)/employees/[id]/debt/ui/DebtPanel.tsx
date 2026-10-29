"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

type Item = {
  id: string;
  date: string;
  type: "LOAN_GIVEN" | "DEBT_COLLECTED";
  amountCents: number;
  currency: string;
  note: string | null;
  voidedAt: string | null;
  voidedBy: string | null;
};

type AuditEntry = {
  id: string;
  action: string;
  createdAt: string;
  actorRole: string | null;
  actorUserId: string | null;
  actorName: string | null;
  metadata: { employeeId?: string; amountCents?: number; type?: string } | null;
};

function money(cents: number, currency: string) {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}

export default function DebtPanel(props: { employeeId: string; currency: string }) {
  const t = useTranslations("admin.debtPanel");
  const tCommon = useTranslations("common");
  const [items, setItems] = useState<Item[]>([]);
  const [openingDebtCents, setOpeningDebtCents] = useState(0);
  const [debtBalance, setDebtBalance] = useState(0);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmVoid, setConfirmVoid] = useState<Item | null>(null);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<Item["type"]>("LOAN_GIVEN");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const amountCents = useMemo(() => {
    const n = Number(amount.replace(",", "."));
    if (!Number.isFinite(n)) return NaN;
    return Math.round(n * 100);
  }, [amount]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/employees/${props.employeeId}/debt-transactions`, {
        credentials: "include",
      });
      const data = (await res.json().catch(() => null)) as {
        items?: Item[];
        error?: string;
        openingDebtCents?: number;
        debtBalance?: number;
        audit?: AuditEntry[];
      } | null;
      if (!res.ok || !data?.items || data.openingDebtCents === undefined) {
        setError(t("errors.load"));
        return;
      }
      setOpeningDebtCents(data.openingDebtCents);
      setDebtBalance(data.debtBalance ?? 0);
      setItems(data.items);
      setAudit(data.audit ?? []);
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
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setError(t("errors.amount"));
      return;
    }
    const res = await fetch(`/api/admin/employees/${props.employeeId}/debt-transactions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        date,
        type,
        amountCents,
        currency: props.currency,
        note: note.trim() ? note.trim() : null,
      }),
    });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setError(t("errors.create"));
      return;
    }
    setAmount("");
    setNote("");
    await load();
  }

  async function voidTransaction(id: string) {
    setError(null);
    const res = await fetch(`/api/admin/employees/${props.employeeId}/debt-transactions/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setError(t("errors.delete"));
      return;
    }
    await load();
  }

  const typeLabel = (value: Item["type"]) =>
    value === "LOAN_GIVEN" ? t("types.loanGiven") : t("types.debtCollected");

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950">
        <div className="text-sm font-semibold">{t("addTransaction")}</div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t("fields.date")}</span>
            <input
              type="date"
              className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t("fields.type")}</span>
            <select
              className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
              value={type}
              onChange={(e) => setType(e.target.value as Item["type"])}
            >
              <option value="LOAN_GIVEN">{t("types.loanGiven")}</option>
              <option value="DEBT_COLLECTED">{t("types.debtCollected")}</option>
            </select>
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
          <label className="flex flex-col gap-1 sm:col-span-4">
            <span className="text-sm font-medium">{t("fields.note")}</span>
            <input
              className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("placeholders.note")}
            />
          </label>
        </div>
        {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b border-black/10 px-3 py-2 text-sm dark:border-white/10">
          <div>
            <div className="font-semibold">{t("recentTransactions")}</div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400">
              {t("openingBalance", { amount: money(openingDebtCents, props.currency) })}
            </div>
          </div>
          <div className="text-zinc-600 dark:text-zinc-400">
            {t("debtBalance", { amount: money(debtBalance, props.currency) })}
          </div>
        </div>
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-black/5 text-left dark:bg-white/10">
            <tr>
              <th className="px-3 py-2 font-medium">{t("table.date")}</th>
              <th className="px-3 py-2 font-medium">{t("table.type")}</th>
              <th className="px-3 py-2 font-medium">{t("table.amount")}</th>
              <th className="px-3 py-2 font-medium">{t("table.note")}</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-black/10 dark:border-white/10">
                <td className="px-3 py-2 font-mono">{item.date}</td>
                <td className="px-3 py-2 text-xs">{typeLabel(item.type)}</td>
                <td className="px-3 py-2">{money(item.amountCents, item.currency)}</td>
                <td className="px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400">
                  {item.note ?? ""}
                  {item.voidedAt ? (
                    <div className="mt-1 text-xs text-amber-600 dark:text-amber-300">
                      {t("status.voided")}
                      {item.voidedBy ? ` • ${item.voidedBy}` : ""}
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right">
                  {!item.voidedAt ? (
                    <button
                      className="rounded-md px-3 py-2 text-sm text-red-700 hover:bg-red-500/10 dark:text-red-300"
                      onClick={() => setConfirmVoid(item)}
                    >
                      {t("actions.void")}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-zinc-500" colSpan={5}>
                  {loading ? tCommon("loading") : t("empty")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-black/10 bg-white p-4 text-sm shadow-sm dark:border-white/10 dark:bg-zinc-950">
        <div className="text-sm font-semibold">{t("activity.title")}</div>
        <div className="mt-3 flex flex-col gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          {audit.length === 0 ? (
            <div>{t("activity.empty")}</div>
          ) : (
            audit.map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-mono text-xs text-zinc-500">{entry.createdAt}</div>
                <div className="text-xs">
                  {entry.action}
                  {entry.metadata?.amountCents !== undefined ? (
                    <span className="ml-2 text-zinc-500">
                      {money(entry.metadata.amountCents, props.currency)} • {entry.metadata.type}
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-zinc-500">{entry.actorName ?? entry.actorRole ?? ""}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {confirmVoid ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-lg dark:bg-zinc-950">
            <div className="text-sm font-semibold">{t("actions.confirmVoidTitle")}</div>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {t("actions.confirmVoidBody")}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-md px-3 py-2 text-sm text-zinc-600 hover:bg-black/5 dark:text-zinc-200 dark:hover:bg-white/10"
                onClick={() => setConfirmVoid(null)}
              >
                {tCommon("cancel")}
              </button>
              <button
                className="rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white"
                onClick={() => {
                  void voidTransaction(confirmVoid.id);
                  setConfirmVoid(null);
                }}
              >
                {t("actions.void")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
