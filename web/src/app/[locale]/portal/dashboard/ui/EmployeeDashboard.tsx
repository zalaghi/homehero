"use client";

import { useEffect, useMemo, useState } from "react";
import AppIcon from "@/components/AppIcon";
import { useLocale, useTranslations } from "next-intl";

type DashboardResponse = {
  employee: {
    publicId: string;
    firstName: string;
    lastName: string;
    currency: string;
    timezone: string;
    payFrequency: "WEEKLY_ISO" | "MONTHLY";
    dailyRateCents: number;
  };
  today: string;
  todayStatus: "WORKING" | "OFF" | "HOLIDAY" | "WEEKEND" | "AWAY";
  ranges: { weekStart: string; weekEnd: string; monthStart: string; yearStart: string };
  stats: {
    week: { validDays: number; grossPayCents: number; netPayCents: number };
    month: { validDays: number; grossPayCents: number; netPayCents: number };
    year: { validDays: number; grossPayCents: number; netPayCents: number };
    debtPaidTotal: number;
    debtBalance: number;
  };
  todos: {
    openCount: number;
  };
  essentials: {
    neededSoonCount: number;
  };
};

function money(locale: string, cents: number, currency: string) {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

type Scope = "WEEK" | "MONTH" | "YEAR";

export default function EmployeeDashboard(props: { publicId: string; locale: string }) {
  const t = useTranslations("portal.dashboardCard");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedScope, setScope] = useState<Scope | null>(null);
  const scope = selectedScope ?? (data?.employee.payFrequency === "MONTHLY" ? "MONTH" : "WEEK");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/employee/dashboard", {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as DashboardResponse | { error?: string } | null;
      if (!res.ok || !json || "error" in json) {
        setError(
          ("error" in (json ?? {}) ? (json as { error?: string }).error : undefined) ??
            t("errors.load"),
        );
        return;
      }
      setData(json as DashboardResponse);
    } catch {
      setError(t("errors.load"));
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
  }, []);

  const currency = data?.employee.currency ?? "EUR";
  const debtLeft = data?.stats.debtBalance ?? 0;
  const todoOpenCount = data?.todos.openCount ?? 0;
  const essentialsNeedCount = data?.essentials.neededSoonCount ?? 0;

  const debtLeftLabel = useMemo(() => {
    if (debtLeft > 0) return t("debtRemaining");
    if (debtLeft < 0) return t("overpaidCredit");
    return t("debtRemaining");
  }, [debtLeft, t]);


  const scopeStats = useMemo(() => {
    if (!data) return null;
    if (scope === "MONTH") return data.stats.month;
    if (scope === "YEAR") return data.stats.year;
    return data.stats.week;
  }, [data, scope]);

  const scopeRange = useMemo(() => {
    if (!data) return "";
    if (scope === "MONTH") return `${data.ranges.monthStart} → ${data.today}`;
    if (scope === "YEAR") return `${data.ranges.yearStart} → ${data.today}`;
    return `${data.ranges.weekStart} → ${data.ranges.weekEnd}`;
  }, [data, scope]);

  function scopeLabel(scopeValue: Scope) {
    if (scopeValue === "WEEK") return t("scope.week");
    if (scopeValue === "MONTH") return t("scope.month");
    return t("scope.year");
  }

  function statusLabel(status: DashboardResponse["todayStatus"]) {
    switch (status) {
      case "WORKING":
        return t("status.working");
      case "HOLIDAY":
        return t("status.holiday");
      case "WEEKEND":
        return t("status.weekend");
      case "AWAY":
        return t("status.away");
      default:
        return t("status.off");
    }
  }

  if (!data && !error) return <div className="animate-pulse space-y-4" aria-label={tCommon("loading")}><div className="h-16 rounded-2xl bg-emerald-900/5" /><div className="h-64 rounded-3xl bg-emerald-900/10" /><div className="grid grid-cols-2 gap-3"><div className="h-32 rounded-2xl bg-emerald-900/5" /><div className="h-32 rounded-2xl bg-emerald-900/5" /></div></div>;
  const formattedDate = data ? new Intl.DateTimeFormat(locale, {weekday:"long", day:"numeric", month:"long", timeZone:"UTC"}).format(new Date(data.today+"T12:00:00Z")) : "";
  return (
    <div className="flex min-w-0 flex-col gap-5">
      {error && <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-200">{error}<button className="ms-3 underline" disabled={loading} onClick={()=>void load()}>{tCommon("refresh")}</button></div>}
      {data && <>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><h1 className="text-2xl font-semibold tracking-tight">{data.employee.firstName} {data.employee.lastName}</h1><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{formattedDate}</p></div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-700/15 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-800 dark:text-emerald-200"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />{statusLabel(data.todayStatus)}</div>
        </div>
        <section className="hh-hero" aria-label={scopeLabel(scope)}>
          <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-sm font-medium">{scopeLabel(scope)}</span><div className="hh-scope flex rounded-full p-1">{(["WEEK","MONTH","YEAR"] as const).map(value=><button key={value} aria-pressed={scope===value} className="rounded-full px-3 py-2 text-xs font-medium transition" onClick={()=>setScope(value)}>{value === "WEEK" ? t("scopeShort.week") : value === "MONTH" ? t("scopeShort.month") : t("scopeShort.year")}</button>)}</div></div>
          <p className="hh-hero-muted mt-6 text-sm">{t("earnings")}</p>
          <div className="hh-amount mt-1 break-words text-[clamp(2rem,10vw,3.25rem)] font-semibold leading-tight tracking-tight">{money(locale, scopeStats?.netPayCents ?? 0, currency)}</div>
          <p className="hh-hero-muted mt-2 text-xs">{t("gross", {amount: money(locale, scopeStats?.grossPayCents ?? 0,currency)})}</p>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-3 border-t border-white/20 pt-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10"><AppIcon name="calendar" className="h-5 w-5" /></span><div><span className="hh-amount text-xl font-semibold">{scopeStats?.validDays ?? 0}</span><p className="hh-hero-muted text-xs">{t("workedDays")}</p></div></div><span dir="ltr" className="hh-hero-muted text-[11px]">{scopeRange}</span></div>
        </section>
        <div className="grid grid-cols-2 gap-3">
          <a className="hh-quick-card group" href={`/${props.locale}/portal/${props.publicId}/todos`}><div className="flex items-center justify-between gap-2"><span className="hh-summary-icon"><AppIcon name="tasks" className="h-5 w-5" /></span><span className="hh-amount text-2xl font-semibold">{todoOpenCount}</span></div><div className="mt-2 text-sm font-semibold">{t("cards.todos")}</div><div className="mt-2 flex items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400"><span>{t("cards.viewTasks")}</span><AppIcon name="arrow" className="h-4 w-4 shrink-0 rtl:rotate-180" /></div></a>
          <a className="hh-quick-card group" href={`/${props.locale}/portal/${props.publicId}/essentials`}><div className="flex items-center justify-between gap-2"><span className="hh-summary-icon"><AppIcon name="basket" className="h-5 w-5" /></span><span className="hh-amount text-2xl font-semibold">{essentialsNeedCount}</span></div><div className="mt-2 text-sm font-semibold">{t("cards.essentials")}</div><div className="mt-2 flex items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400"><span>{t("cards.viewEssentials")}</span><AppIcon name="arrow" className="h-4 w-4 shrink-0 rtl:rotate-180" /></div></a>
        </div>
        <details className="rounded-2xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-950"><summary className="flex cursor-pointer items-center gap-3 text-sm font-semibold"><AppIcon name="wallet" className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />{t("finance")}<span className="ms-auto text-lg text-zinc-400">+</span></summary><div className="mt-4 grid gap-4 border-t border-black/10 pt-4 sm:grid-cols-2 dark:border-white/10"><div><p className="text-xs text-zinc-500 dark:text-zinc-400">{debtLeftLabel}</p><p className="hh-amount mt-1 text-xl font-semibold">{money(locale,Math.abs(debtLeft),currency)}</p></div><div><p className="text-xs text-zinc-500 dark:text-zinc-400">{t("debtPaid")}</p><p className="hh-amount mt-1 text-xl font-semibold">{money(locale,data.stats.debtPaidTotal,currency)}</p></div></div></details>
      </>}
    </div>
  );
}
