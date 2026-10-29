"use client";

import DeleteButton from "@/components/DeleteButton";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Delivery = { id: string; status: string; attempts: number; acceptedAt: string | null; receivedAt: string | null; clickedAt: string | null; lastError: string | null; createdAt: string; notification: { title: string } };

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
  expirationTime: string | null;
};

export default function PushSubscriptionsPanel({ employeeId }: { employeeId: string }) {
  const t = useTranslations("admin.employeePush");
  const d = useTranslations("admin.pushDiagnostics");
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [workerHealthy, setWorkerHealthy] = useState(false);
  const tCommon = useTranslations("common");
  const [items, setItems] = useState<PushSubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/employees/${employeeId}/push-subscriptions`, {
        credentials: "include",
        cache: "no-store",
      });
      const data =
        (await res.json().catch(() => null)) as { subscriptions?: PushSubscriptionRow[]; deliveries?: Delivery[]; workerHealthy?: boolean; error?: string } | null;
      if (!res.ok || !data) {
        setError(data?.error ?? t("errors.load"));
        return;
      }
      setItems(data.subscriptions ?? []);
      setDeliveries(data.deliveries ?? []); setWorkerHealthy(data.workerHealthy ?? false);
    } catch { setError(t("errors.load")); } finally {
      setLoading(false);
    }
  }, [employeeId, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- This effect synchronizes the remote resource and its loading state.
    void load();
  }, [load]);

  const handleTest = async () => {
    setTesting(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/admin/employees/${employeeId}/push-test`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const data = (await res.json().catch(() => null)) as { sent?: number; failed?: number; error?: string } | null;
      if (!res.ok || !data) {
        setStatus(t("errors.test"));
        return;
      }
      if (data.error === "VAPID_CONFIG_MISSING") {
        setStatus(t("errors.missingConfig"));
        return;
      }
      setStatus(d("testResult", { sent: data.sent ?? 0, failed: data.failed ?? 0 }));
      await load();
    } catch {
      setStatus(t("errors.test"));
    } finally {
      setTesting(false);
    }
  };

  const formatEndpoint = (endpoint: string) => {
    if (endpoint.length <= 42) return endpoint;
    return `${endpoint.slice(0, 32)}…${endpoint.slice(-8)}`;
  };

  return (
    <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium">{t("title")}</div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {t("count", { count: items.length })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-black/10 px-3 py-1.5 text-xs font-semibold text-zinc-600 transition hover:bg-black/5 disabled:opacity-60 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/10"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? tCommon("loading") : tCommon("refresh")}
          </button>
          <button
            type="button"
            className="rounded-md border border-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-60 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
            onClick={() => void handleTest()}
            disabled={testing}
          >
            {testing ? tCommon("loading") : t("actions.test")}
          </button>
        </div>
      </div>

      {status ? <div className="mt-2 text-xs text-emerald-600">{status}</div> : null}
      {error ? <div className="mt-2 text-xs text-rose-600">{error}</div> : null}

      <div className="mt-3 space-y-2 text-xs text-zinc-600 dark:text-zinc-300">
        {loading ? (
          <div className="text-zinc-500">{tCommon("loading")}</div>
        ) : items.length === 0 ? (
          <div className="text-zinc-500">{t("empty")}</div>
        ) : (
          items.map((subscription) => (
            <div
              key={subscription.id}
              className="rounded-lg border border-black/10 bg-white/50 p-3 dark:border-white/10 dark:bg-zinc-900"
            >
              <div className="font-medium text-zinc-700 dark:text-zinc-200">
                {t("labels.endpoint")}: {formatEndpoint(subscription.endpoint)}
              </div>
              <div className="mt-2"><DeleteButton url={`/api/admin/employees/${employeeId}/push-subscriptions/${subscription.id}`} name={subscription.endpoint} onDeleted={load} /></div>
              {subscription.userAgent ? (
                <div className="mt-1 text-zinc-500">
                  {t("labels.userAgent")}: {subscription.userAgent}
                </div>
              ) : null}
              <div className="mt-1 text-zinc-500">
                {t("labels.createdAt")}: {new Date(subscription.createdAt).toLocaleString()}
              </div>
              <div className="text-zinc-500">
                {t("labels.updatedAt")}: {new Date(subscription.updatedAt).toLocaleString()}
              </div>
              {subscription.expirationTime ? (
                <div className="text-zinc-500">
                  {t("labels.expirationTime")}: {new Date(subscription.expirationTime).toLocaleString()}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
      <section className="mt-5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <h3 className="text-sm font-semibold">{d("title")}</h3>
        <p className={`mt-2 text-xs ${workerHealthy ? "text-emerald-600" : "text-amber-600"}`}>{d(workerHealthy ? "healthy" : "unhealthy")}</p>
        <div className="mt-3 space-y-2">{deliveries.length === 0 ? <p className="text-xs text-zinc-500">{d("empty")}</p> : deliveries.map(item => <div key={item.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="text-sm font-medium">{item.notification.title}</p>
          <p className="mt-1 text-xs">{d(item.clickedAt ? "clicked" : item.receivedAt ? "displayed" : item.status.toLowerCase())}</p>
          <p className="mt-1 text-xs text-zinc-500">{d("attempts", { count: item.attempts })} · {new Date(item.createdAt).toLocaleString()}</p>
          {item.lastError && <p className="mt-1 text-xs text-amber-600">{item.lastError}</p>}
        </div>)}</div>
      </section>
    </div>
  );
}
