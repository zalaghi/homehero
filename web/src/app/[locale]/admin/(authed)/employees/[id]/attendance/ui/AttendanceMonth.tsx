"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

type Item = {
  date: string;
  worked: boolean;
  authorizedExtra: boolean;
  validWorkedDay: boolean;
  isHoliday: boolean;
  isWeekend: boolean;
  source?: string;
  firstEntryTime: string | null;
  lastExitTime: string | null;
  uncertainty: boolean;
  weekendRequest: {
    id: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
  } | null;
};

type AttendanceResponse = {
  items: Item[];
  period: { start: string; end: string };
};

type PayFrequency = "WEEKLY_ISO" | "MONTHLY";

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isAttendanceResponse(
  data: AttendanceResponse | { error?: string } | null,
): data is AttendanceResponse {
  return !!data && "items" in data;
}

export default function AttendanceMonth(props: {
  employeeId: string;
  payFrequency: PayFrequency;
  timeZone: string;
}) {
  const t = useTranslations("admin.attendance");
  const tCommon = useTranslations("common");
  const [cursor, setCursor] = useState(() => new Date());
  const [items, setItems] = useState<Item[]>([]);
  const [periodStart, setPeriodStart] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);

  const cursorIso = useMemo(() => toIsoDate(cursor), [cursor]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const period = props.payFrequency === "WEEKLY_ISO" ? "weekly" : "monthly";
      const res = await fetch(
        `/api/admin/employees/${props.employeeId}/attendance?period=${period}&cursor=${cursorIso}`,
        { credentials: "include" },
      );
      const data = (await res.json().catch(() => null)) as
        | AttendanceResponse
        | { error?: string }
        | null;
      if (!res.ok || !isAttendanceResponse(data)) {
        const message = !res.ok && data && "error" in data ? data.error : null;
        setError(message ?? t("errors.load"));
        return;
      }
      setItems(data.items);
      setPeriodStart(data.period.start);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- This effect synchronizes the remote resource and its loading state.
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursorIso, props.employeeId, props.payFrequency]);

  async function patchDay(date: string, next: Partial<Pick<Item, "worked" | "authorizedExtra">>) {
    const current = items.find((i) => i.date === date);
    if (!current) return;

    const optimistic = items.map((i) =>
      i.date === date ? { ...i, ...next } : i,
    );
    setItems(optimistic);

    const res = await fetch(`/api/admin/employees/${props.employeeId}/attendance`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        date,
        worked: next.worked ?? current.worked,
        authorizedExtra: next.authorizedExtra ?? current.authorizedExtra,
      }),
    });

    if (!res.ok) {
      setError(t("errors.save"));
      await load();
      return;
    }
    await load();
  }

  async function updateWeekendRequest(
    id: string,
    status: "APPROVED" | "REJECTED" | "PENDING",
    currentStatus?: "PENDING" | "APPROVED" | "REJECTED",
  ) {
    if (currentStatus && currentStatus !== "PENDING" && status !== currentStatus) {
      const ok = window.confirm(t("confirmChangeDecision"));
      if (!ok) return;
    }
    setRequestError(null);
    setPendingRequestId(id);
    const res = await fetch(`/api/admin/employees/${props.employeeId}/weekend-requests`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setRequestError(data?.error ?? t("errors.updateWeekendRequest"));
      setPendingRequestId(null);
      return;
    }
    setPendingRequestId(null);
    await load();
  }

  const weekendRequests = useMemo(
    () =>
      items
        .filter((item) => item.weekendRequest)
        .map((item) => ({
          date: item.date,
          id: item.weekendRequest!.id,
          status: item.weekendRequest!.status,
          isHoliday: item.isHoliday,
          isWeekend: item.isWeekend,
        })),
    [items],
  );
  const pendingWeekendRequests = weekendRequests.filter((item) => item.status === "PENDING");

  const title = useMemo(() => {
    if (props.payFrequency === "WEEKLY_ISO") {
      const weekLabel = periodStart ?? cursorIso;
      return t("weekOf", { date: weekLabel });
    }
    const fmt = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "long", timeZone: props.timeZone });
    const labelDate = periodStart ?? cursorIso;
    return fmt.format(new Date(`${labelDate}T00:00:00Z`));
  }, [cursorIso, periodStart, props.payFrequency, props.timeZone, t]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <button
          className="rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-black/5 dark:text-zinc-200 dark:hover:bg-white/10"
          onClick={() =>
            setCursor((d) =>
              props.payFrequency === "WEEKLY_ISO"
                ? new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - 7))
                : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)),
            )
          }
        >
          {tCommon("prev")}
        </button>
        <div className="text-sm font-semibold">{title}</div>
        <button
          className="rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-black/5 dark:text-zinc-200 dark:hover:bg-white/10"
          onClick={() =>
            setCursor((d) =>
              props.payFrequency === "WEEKLY_ISO"
                ? new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 7))
                : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)),
            )
          }
        >
          {tCommon("next")}
        </button>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      {requestError ? <div className="text-sm text-red-600">{requestError}</div> : null}

      <div className="rounded-xl border border-black/10 bg-white px-4 py-3 text-sm shadow-sm dark:border-white/10 dark:bg-zinc-950">
        <div className="font-medium">
          {t("pendingSummary", { count: pendingWeekendRequests.length })}
        </div>
        {pendingWeekendRequests.length > 0 ? (
          <div className="mt-3 flex flex-col gap-2 text-xs text-zinc-600 dark:text-zinc-300">
            {pendingWeekendRequests.map((request) => (
              <div
                key={request.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/10 px-2 py-2 dark:border-white/10"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={`#weekend-request-${request.date}`}
                    className="font-mono text-xs text-zinc-700 hover:underline dark:text-zinc-200"
                  >
                    {request.date}
                  </a>
                  {request.isHoliday ? (
                    <span className="rounded bg-amber-500/15 px-2 py-1 text-amber-700 dark:text-amber-200">
                      {t("status.holiday")}
                    </span>
                  ) : null}
                  {request.isWeekend ? (
                    <span className="rounded bg-blue-500/15 px-2 py-1 text-blue-700 dark:text-blue-200">
                      {t("status.weekend")}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="rounded border border-black/10 px-2 py-1 hover:bg-black/5 disabled:opacity-60 dark:border-white/10 dark:hover:bg-white/10"
                    disabled={pendingRequestId === request.id}
                    onClick={() => void updateWeekendRequest(request.id, "APPROVED", request.status)}
                  >
                    {tCommon("approve")}
                  </button>
                  <button
                    type="button"
                    className="rounded border border-black/10 px-2 py-1 hover:bg-black/5 disabled:opacity-60 dark:border-white/10 dark:hover:bg-white/10"
                    disabled={pendingRequestId === request.id}
                    onClick={() => void updateWeekendRequest(request.id, "REJECTED", request.status)}
                  >
                    {tCommon("deny")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-black/5 text-left dark:bg-white/10">
            <tr>
              <th className="px-3 py-2 font-medium">{t("table.date")}</th>
              <th className="px-3 py-2 font-medium">{t("table.holidayWeekend")}</th>
              <th className="px-3 py-2 font-medium">{t("table.weekendRequest")}</th>
              <th className="px-3 py-2 font-medium">{t("table.entryExit")}</th>
              <th className="px-3 py-2 font-medium">{t("table.worked")}</th>
              <th className="px-3 py-2 font-medium">{t("table.authorizedExtra")}</th>
              <th className="px-3 py-2 font-medium">{t("table.valid")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((d) => {
              const weekendRequest = d.weekendRequest;
              return (
                <tr
                  key={d.date}
                  className="border-t border-black/10 dark:border-white/10"
                  id={weekendRequest ? `weekend-request-${d.date}` : undefined}
                >
                  <td className="px-3 py-2 font-mono">{d.date}</td>
                  <td className="px-3 py-2 text-xs">
                    {d.isHoliday ? (
                      <span className="rounded bg-amber-500/15 px-2 py-1 text-amber-700 dark:text-amber-200">
                        {t("status.holiday")}
                      </span>
                    ) : null}
                    {d.isWeekend ? (
                      <span className="ml-2 rounded bg-blue-500/15 px-2 py-1 text-blue-700 dark:text-blue-200">
                        {t("status.weekend")}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {weekendRequest ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded px-2 py-1 ${
                            weekendRequest.status === "APPROVED"
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200"
                              : weekendRequest.status === "REJECTED"
                              ? "bg-rose-500/15 text-rose-700 dark:text-rose-200"
                              : "bg-amber-500/15 text-amber-700 dark:text-amber-200"
                          }`}
                        >
                          {weekendRequest.status === "APPROVED"
                            ? t("status.approved")
                            : weekendRequest.status === "REJECTED"
                            ? t("status.denied")
                            : t("status.pending")}
                        </span>
                        {weekendRequest.status !== "APPROVED" ? (
                          <button
                            type="button"
                            className="rounded border border-black/10 px-2 py-1 hover:bg-black/5 disabled:opacity-60 dark:border-white/10 dark:hover:bg-white/10"
                            disabled={pendingRequestId === weekendRequest.id}
                            onClick={() =>
                              void updateWeekendRequest(weekendRequest.id, "APPROVED", weekendRequest.status)
                            }
                          >
                            {tCommon("approve")}
                          </button>
                        ) : null}
                        {weekendRequest.status !== "REJECTED" ? (
                          <button
                            type="button"
                            className="rounded border border-black/10 px-2 py-1 hover:bg-black/5 disabled:opacity-60 dark:border-white/10 dark:hover:bg-white/10"
                            disabled={pendingRequestId === weekendRequest.id}
                            onClick={() =>
                              void updateWeekendRequest(weekendRequest.id, "REJECTED", weekendRequest.status)
                            }
                          >
                            {tCommon("deny")}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="rounded border border-black/10 px-2 py-1 text-xs hover:bg-black/5 disabled:opacity-60 dark:border-white/10 dark:hover:bg-white/10"
                          disabled={pendingRequestId === weekendRequest.id}
                          onClick={() =>
                            void updateWeekendRequest(weekendRequest.id, "PENDING", weekendRequest.status)
                          }
                        >
                          {t("actions.reset")}
                        </button>
                      </div>
                    ) : null}
                  </td>
                <td className="px-3 py-2 text-xs">
                  {d.firstEntryTime ? (
                    <span className="rounded bg-emerald-500/10 px-2 py-1 font-mono text-emerald-700 dark:text-emerald-200">
                      {t("entry", {
                        time: new Date(d.firstEntryTime).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        }),
                      })}
                    </span>
                  ) : (
                    <span className="text-zinc-500">{t("noEntry")}</span>
                  )}
                  {d.lastExitTime ? (
                    <span className="ml-2 rounded bg-sky-500/10 px-2 py-1 font-mono text-sky-700 dark:text-sky-200">
                      {t("exit", {
                        time: new Date(d.lastExitTime).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        }),
                      })}
                    </span>
                  ) : (
                    <span className="ml-2 text-zinc-500">{t("noExit")}</span>
                  )}
                  {d.uncertainty ? (
                    <span className="ml-2 rounded bg-amber-500/15 px-2 py-1 text-amber-700 dark:text-amber-200">
                      {t("uncertain")}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={d.worked}
                    disabled={loading}
                    onChange={(e) => void patchDay(d.date, { worked: e.target.checked })}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={d.authorizedExtra}
                    disabled={loading}
                    onChange={(e) => void patchDay(d.date, { authorizedExtra: e.target.checked })}
                  />
                </td>
                <td className="px-3 py-2">
                  {d.validWorkedDay ? (
                    <span className="rounded bg-emerald-500/15 px-2 py-1 text-emerald-700 dark:text-emerald-200">
                      {tCommon("yes")}
                    </span>
                  ) : (
                    <span className="text-zinc-500">{tCommon("no")}</span>
                  )}
                </td>
              </tr>
              );
            })}
            {items.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-zinc-500" colSpan={7}>
                  {loading ? tCommon("loading") : t("emptyDays")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
