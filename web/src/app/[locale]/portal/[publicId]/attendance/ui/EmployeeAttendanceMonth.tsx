"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

type AttendanceItem = {
  date: string;
  worked: boolean;
  authorizedExtra: boolean;
  validWorkedDay: boolean;
  isHoliday: boolean;
  isWeekend: boolean;
};

type AttendanceResponse = {
  items: AttendanceItem[];
  period: { start: string; end: string };
};

type PayFrequency = "WEEKLY_ISO" | "MONTHLY";

type Profile = { payFrequency: PayFrequency; timezone: string };

type AbsenceItem = {
  id: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  createdAt: string;
};

type WeekendRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

type WeekendRequestItem = {
  id: string;
  date: string;
  status: WeekendRequestStatus;
  createdAt: string;
  updatedAt: string;
};

function startOfMonthIso(d: Date): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  return x.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isAttendanceResponse(
  data: AttendanceResponse | { error?: string } | null,
): data is AttendanceResponse {
  return !!data && "items" in data;
}

function isProfile(data: Profile | { error?: string } | null): data is Profile {
  return !!data && "payFrequency" in data && "timezone" in data;
}

function badgeClass(variant: "primary" | "muted" | "warn") {
  if (variant === "primary") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200";
  if (variant === "warn") return "bg-amber-500/15 text-amber-700 dark:text-amber-200";
  return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
}

export default function EmployeeAttendanceMonth() {
  const t = useTranslations("portal.attendance");
  const tCommon = useTranslations("common");
  const [cursor, setCursor] = useState(() => new Date());
  const [items, setItems] = useState<AttendanceItem[]>([]);
  const [periodStart, setPeriodStart] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [absences, setAbsences] = useState<AbsenceItem[]>([]);
  const [weekendRequests, setWeekendRequests] = useState<WeekendRequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [absencesLoading, setAbsencesLoading] = useState(false);
  const [weekendLoading, setWeekendLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [absenceError, setAbsenceError] = useState<string | null>(null);
  const [weekendError, setWeekendError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [pendingDate, setPendingDate] = useState<string | null>(null);

  const start = useMemo(() => startOfMonthIso(cursor), [cursor]);
  const cursorIso = useMemo(() => toIsoDate(cursor), [cursor]);
  const today = useMemo(() => todayIso(), []);

  async function loadAttendance() {
    setLoading(true);
    setError(null);
    try {
      const period = profile?.payFrequency === "WEEKLY_ISO" ? "weekly" : "monthly";
      const res = await fetch(`/api/employee/attendance?period=${period}&cursor=${cursorIso}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as AttendanceResponse | { error?: string } | null;
      if (!res.ok || !isAttendanceResponse(data)) {
        const message = !res.ok && data && "error" in data ? data.error : null;
        setError(message ?? t("errors.loadAttendance"));
        return;
      }
      setItems(data.items);
      setPeriodStart(data.period.start);
    } finally {
      setLoading(false);
    }
  }

  async function loadAbsences() {
    setAbsencesLoading(true);
    setAbsenceError(null);
    try {
      const res = await fetch("/api/employee/absences", {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as { items?: AbsenceItem[]; error?: string } | null;
      if (!res.ok || !data?.items) {
        setAbsenceError(data?.error ?? t("errors.loadAbsences"));
        return;
      }
      setAbsences(data.items);
    } finally {
      setAbsencesLoading(false);
    }
  }

  async function loadWeekendRequests() {
    setWeekendLoading(true);
    setWeekendError(null);
    try {
      const res = await fetch("/api/employee/weekend-requests", {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as { items?: WeekendRequestItem[]; error?: string } | null;
      if (!res.ok || !data?.items) {
        setWeekendError(data?.error ?? t("errors.loadWeekendRequests"));
        return;
      }
      setWeekendRequests(data.items);
    } finally {
      setWeekendLoading(false);
    }
  }

  useEffect(() => {
    async function loadProfile() {
      const res = await fetch("/api/employee/profile", { credentials: "include", cache: "no-store" });
      const data = (await res.json().catch(() => null)) as Profile | { error?: string } | null;
      if (!res.ok || !isProfile(data)) return;
      setProfile({ payFrequency: data.payFrequency, timezone: data.timezone });
    }

    void loadProfile();
  }, []);

  useEffect(() => {
    if (!profile) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- This effect synchronizes the remote resource and its loading state.
    void loadAttendance();
    void loadAbsences();
    void loadWeekendRequests();
    const handleRefresh = () => {
      void loadAttendance();
      void loadAbsences();
      void loadWeekendRequests();
    };
    window.addEventListener("app:refresh", handleRefresh);
    return () => window.removeEventListener("app:refresh", handleRefresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, cursorIso]);

  const title = useMemo(() => {
    if (!profile) return "";
    if (profile.payFrequency === "WEEKLY_ISO") {
      const weekLabel = periodStart ?? cursorIso;
      return t("titleWeekOf", { date: weekLabel });
    }
    const fmt = new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "long",
      timeZone: profile.timezone,
    });
    const labelDate = periodStart ?? start;
    return fmt.format(new Date(`${labelDate}T00:00:00Z`));
  }, [cursorIso, periodStart, profile, start, t]);

  async function createAbsence(date: string) {
    const res = await fetch("/api/employee/absences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        startDate: date,
        endDate: date,
      }),
    });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setAbsenceError(data?.error ?? t("errors.createAbsence"));
      return false;
    }
    return true;
  }

  async function cancelAbsence(id: string) {
    const res = await fetch(`/api/employee/absences/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setAbsenceError(data?.error ?? t("errors.cancelAbsence"));
      return false;
    }
    return true;
  }

  async function cancelAbsenceById(absence: AbsenceItem) {
    if (pendingDate) return;
    setActionMessage(null);
    setAbsenceError(null);
    setPendingDate(absence.startDate);
    const ok = await cancelAbsence(absence.id);
    setPendingDate(null);
    if (!ok) return;
    setActionMessage(t("messages.timeOffRemoved"));
    await loadAbsences();
  }

  async function toggleAbsence(date: string) {
    if (pendingDate) return;
    setActionMessage(null);
    setAbsenceError(null);
    setPendingDate(date);
    const existing = absences.find((absence) => date >= absence.startDate && date <= absence.endDate);
    const ok = existing ? await cancelAbsence(existing.id) : await createAbsence(date);
    setPendingDate(null);
    if (!ok) return;
    setActionMessage(existing ? t("messages.timeOffRemoved") : t("messages.timeOffPlanned"));
    await loadAbsences();
  }

  async function createWeekendRequest(date: string) {
    const res = await fetch("/api/employee/weekend-requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ date }),
    });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setWeekendError(data?.error ?? t("errors.createWeekendRequest"));
      return false;
    }
    return true;
  }

  async function cancelWeekendRequest(id: string) {
    const res = await fetch(`/api/employee/weekend-requests/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setWeekendError(data?.error ?? t("errors.cancelWeekendRequest"));
      return false;
    }
    return true;
  }

  async function toggleWeekendRequest(date: string, request: WeekendRequestItem | undefined) {
    if (pendingDate) return;
    setActionMessage(null);
    setWeekendError(null);
    setPendingDate(date);
    const ok = request ? await cancelWeekendRequest(request.id) : await createWeekendRequest(date);
    setPendingDate(null);
    if (!ok) return;
    setActionMessage(
      request ? t("messages.weekendRequestCanceled") : t("messages.weekendRequestSent"),
    );
    await loadWeekendRequests();
  }

  function isAbsenceDay(date: string) {
    return absences.some((absence) => date >= absence.startDate && date <= absence.endDate);
  }


  function renderBadge(icon: string, label: string, variant: "primary" | "muted" | "warn") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${badgeClass(variant)}`}
        aria-label={label}
        title={label}
      >
        <span aria-hidden="true">{icon}</span>
        <span className="text-[0.7rem] font-medium uppercase tracking-wide">{label}</span>
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-3 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs text-zinc-700 shadow-sm dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-200">
        <span className="flex items-center gap-1" aria-label={t("legend.worked")}>
          <span aria-hidden="true">✅</span>
          <span>{t("legend.worked")}</span>
        </span>
        <span className="flex items-center gap-1" aria-label={t("legend.timeOff")}>
          <span aria-hidden="true">🏖️</span>
          <span>{t("legend.timeOff")}</span>
        </span>
        <span className="flex items-center gap-1" aria-label={t("legend.weekend")}>
          <span aria-hidden="true">📅</span>
          <span>{t("legend.weekend")}</span>
        </span>
        <span className="flex items-center gap-1" aria-label={t("legend.holiday")}>
          <span aria-hidden="true">⛱️</span>
          <span>{t("legend.holiday")}</span>
        </span>
        <span className="flex items-center gap-1" aria-label={t("legend.extra")}>
          <span aria-hidden="true">✨</span>
          <span>{t("legend.extra")}</span>
        </span>
      </div>

      {(absenceError || weekendError || actionMessage) && (
        <div className="rounded-xl border border-black/10 bg-white px-4 py-3 text-xs text-zinc-600 shadow-sm dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-200">
          {absenceError ? <div className="text-red-600">{absenceError}</div> : null}
          {weekendError ? <div className="text-red-600">{weekendError}</div> : null}
          {actionMessage ? <div className="text-emerald-600">{actionMessage}</div> : null}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <button
          className="shrink-0 whitespace-nowrap rounded-xl px-2 py-2 text-sm text-zinc-700 hover:bg-black/5 dark:text-zinc-200 dark:hover:bg-white/10"
          onClick={() =>
            setCursor((d) =>
              profile?.payFrequency === "WEEKLY_ISO"
                ? new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - 7))
                : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)),
            )
          }
        >
          {tCommon("prev")}
        </button>
        <div className="min-w-0 text-center text-sm font-semibold">{title}</div>
        <button
          className="shrink-0 whitespace-nowrap rounded-xl px-2 py-2 text-sm text-zinc-700 hover:bg-black/5 dark:text-zinc-200 dark:hover:bg-white/10"
          onClick={() =>
            setCursor((d) =>
              profile?.payFrequency === "WEEKLY_ISO"
                ? new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 7))
                : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)),
            )
          }
        >
          {tCommon("next")}
        </button>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <div className="flex flex-col gap-3">
        {items.map((item) => {
          const isTimeOff = isAbsenceDay(item.date);
          const needsReview = item.worked && !item.validWorkedDay;
          const weekendRequest = weekendRequests.find((request) => request.date === item.date);
          const isPast = item.date < today;
          const isNonWorkingDay = item.isWeekend || item.isHoliday;
          const isEditable = !isPast && !item.worked;
          const hasWorkRequest = !!weekendRequest;
          const isWorkRequestPending = weekendRequest?.status === "PENDING";
          const canToggleWorkRequest = isEditable && isNonWorkingDay && (!hasWorkRequest || isWorkRequestPending);
          const canToggleAbsence = isEditable && !isNonWorkingDay;
          const statusMeta = needsReview
            ? { label: t("status.needsReview"), icon: "⚠️", variant: "warn" as const }
            : isTimeOff
            ? { label: t("status.timeOff"), icon: "🏖️", variant: "primary" as const }
            : item.worked
            ? { label: t("status.worked"), icon: "✅", variant: "primary" as const }
            : { label: t("status.off"), icon: "🕓", variant: "muted" as const };
          const toggleLabel = isNonWorkingDay
            ? hasWorkRequest
              ? t("actions.cancelWeekendRequest")
              : t("actions.requestToWork")
            : isTimeOff
            ? t("actions.cancelTimeOff")
            : t("actions.markTimeOff");
          const isTextAction = (isNonWorkingDay && hasWorkRequest) || (!isNonWorkingDay && isTimeOff);

          return (
            <div
              key={item.date}
              className="rounded-xl border border-black/10 bg-white px-4 py-3 shadow-sm transition dark:border-white/10 dark:bg-zinc-950"
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-sm font-semibold">{item.date}</div>
                <div className="ms-auto flex items-center gap-3">
                  <div className="flex min-w-[7rem] items-center justify-end gap-2">
                    {isNonWorkingDay && hasWorkRequest ? (
                      <span
                        className={`rounded px-2 py-1 text-xs ${
                          weekendRequest?.status === "APPROVED"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200"
                            : weekendRequest?.status === "REJECTED"
                            ? "bg-rose-500/15 text-rose-700 dark:text-rose-200"
                            : "bg-amber-500/15 text-amber-700 dark:text-amber-200"
                        }`}
                      >
                        {weekendRequest?.status === "APPROVED"
                          ? t("status.approved")
                          : weekendRequest?.status === "REJECTED"
                          ? t("status.denied")
                          : t("status.pending")}
                      </span>
                    ) : null}
                    {canToggleWorkRequest || canToggleAbsence ? (
                      <button
                        type="button"
                        onClick={() =>
                          isNonWorkingDay
                            ? void toggleWeekendRequest(item.date, weekendRequest)
                            : void toggleAbsence(item.date)
                        }
                        aria-label={toggleLabel}
                        title={toggleLabel}
                        disabled={pendingDate === item.date}
                        className={`flex h-8 items-center justify-center rounded-full border border-black/10 text-xs font-medium text-zinc-700 transition hover:bg-black/5 disabled:opacity-60 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/10 ${
                          isTextAction ? "px-3" : "h-8 w-8"
                        }`}
                      >
                        {isNonWorkingDay ? (
                          hasWorkRequest ? (
                            <span>{tCommon("cancel")}</span>
                          ) : (
                            <span aria-hidden="true">✨</span>
                          )
                        ) : isTimeOff ? (
                          <span>{tCommon("cancel")}</span>
                        ) : (
                          <span aria-hidden="true">🏖️</span>
                        )}
                        <span className="sr-only">{toggleLabel}</span>
                      </button>
                    ) : (
                      <span className="inline-block h-8 w-8" />
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-2 text-xs">
                    {needsReview || !isNonWorkingDay
                      ? renderBadge(statusMeta.icon, statusMeta.label, statusMeta.variant)
                      : null}
                    {item.isHoliday ? renderBadge("⛱️", t("status.holiday"), "warn") : null}
                    {item.isWeekend ? renderBadge("📅", t("status.weekend"), "muted") : null}
                    {needsReview ? (
                      <span className="text-xs text-amber-600" title={t("status.needsReviewDetail")}>
                        ⚠
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {item.authorizedExtra && !isNonWorkingDay ? (
                  renderBadge("✨", t("status.extra"), "primary")
                ) : null}
              </div>
            </div>
          );
        })}
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/10 bg-white p-6 text-center text-sm text-zinc-500 dark:border-white/10 dark:bg-zinc-950">
            {loading ? tCommon("loading") : t("emptyDays")}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-sm font-semibold">{t("plannedAbsences")}</div>
        {absences.map((absence) => (
          <div
            key={absence.id}
            className="flex flex-col gap-2 rounded-xl border border-black/10 bg-white p-4 text-sm shadow-sm dark:border-white/10 dark:bg-zinc-950"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-medium">
                {absence.startDate} → {absence.endDate}
              </div>
              <button
                type="button"
                className="rounded-full border border-black/10 px-3 py-1 text-xs text-zinc-600 hover:bg-black/5 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/10"
                onClick={() => void cancelAbsenceById(absence)}
                disabled={pendingDate === absence.startDate}
              >
                Cancel
              </button>
            </div>
            {absence.reason ? <div className="text-xs text-zinc-600 dark:text-zinc-300">{absence.reason}</div> : null}
          </div>
        ))}
        {absences.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/10 bg-white p-4 text-sm text-zinc-500 dark:border-white/10 dark:bg-zinc-950">
            {absencesLoading ? tCommon("loading") : t("noPlannedAbsences")}
          </div>
        ) : null}
      </div>

      {(loading || absencesLoading || weekendLoading) && items.length === 0 ? (
        <div className="text-xs text-zinc-500">{tCommon("loading")}</div>
      ) : null}
    </div>
  );
}
