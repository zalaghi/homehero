"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

type TodoItem = {
  id: string;
  title: string;
  description: string | null;
  status: "OPEN" | "DONE";
  createdAt: string;
  doneAt: string | null;
};

type Filter = "OPEN" | "DONE";

export default function EmployeeTodoList() {
  const t = useTranslations("portal.todos");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [items, setItems] = useState<TodoItem[]>([]);
  const [filter, setFilter] = useState<Filter>("OPEN");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/employee/todos?status=${filter}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as { items?: TodoItem[]; error?: string } | null;
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
    const handleRefresh = () => {
      void load();
    };
    window.addEventListener("app:refresh", handleRefresh);
    return () => window.removeEventListener("app:refresh", handleRefresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function markDone(id: string) {
    setError(null);
    const res = await fetch(`/api/employee/todos/${id}`, {
      method: "PATCH",
      credentials: "include",
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? t("errors.update"));
      return;
    }
    await load();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="inline-flex w-fit rounded-full border border-black/10 bg-white p-1 text-xs dark:border-white/10 dark:bg-zinc-950">
        {(["OPEN", "DONE"] as const).map((value) => (
          <button
            key={value}
            className={`rounded-full px-3 py-1 transition ${
              filter === value
                ? "bg-zinc-950 text-white dark:bg-white dark:text-black"
                : "text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10"
            }`}
            onClick={() => setFilter(value)}
          >
            {value === "OPEN" ? t("filters.open") : t("filters.done")}
          </button>
        ))}
      </div>
      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-black/10 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-zinc-950"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{item.title}</div>
                {item.description ? (
                  <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">{item.description}</div>
                ) : null}
              </div>
              {item.status === "OPEN" ? (
                <button
                  className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-200"
                  onClick={() => void markDone(item.id)}
                >
                  {t("markDone")}
                </button>
              ) : (
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
                  {t("filters.done")}
                </span>
              )}
            </div>
            <div className="mt-2 text-[11px] text-zinc-500">
              {item.status === "DONE" && item.doneAt
                ? t("completedOn", { date: new Date(item.doneAt).toLocaleDateString(locale) })
                : t("createdOn", { date: new Date(item.createdAt).toLocaleDateString(locale) })}
            </div>
          </div>
        ))}
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/10 bg-white p-5 text-center text-sm text-zinc-500 dark:border-white/10 dark:bg-zinc-950">
            {loading ? tCommon("loading") : t("empty")}
          </div>
        ) : null}
      </div>
    </div>
  );
}
