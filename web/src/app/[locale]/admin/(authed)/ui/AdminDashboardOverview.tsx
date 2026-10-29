"use client";

import Link from "next/link";
import AppIcon, { type IconName } from "@/components/AppIcon";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

type DashboardResponse = {
  employees: { total: number };
  absences: { awayNow: number; upcoming: number };
  essentials: { neededSoon: number };
  todos: { open: number };
  payPeriods: { currentReady: number; totalEmployees: number };
  lists: {
    awayNow: { employee: string; until: string }[];
    upcoming: { employee: string; start: string }[];
    todos: { title: string; employee: string }[];
    essentials: { name: string; employee: string }[];
  };
};

type CardProps = {
  title: string;
  value: string;
  subtitle: string;
  href: string;
  cta: string;
  icon: IconName;
};

function SummaryCard({ title, value, subtitle, href, cta, icon }: CardProps) {
  return (
    <Link
      className="hh-summary-card group flex h-full flex-col justify-between rounded-2xl border border-black/10 bg-white p-5 shadow-sm transition hover:border-black/20 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/30 dark:border-white/10 dark:bg-zinc-950 dark:hover:border-white/30 dark:focus-visible:ring-white/40"
      href={href}
    >
      <div className="space-y-2">
        <span className="hh-summary-icon"><AppIcon name={icon} className="h-5 w-5" /></span><p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{title}</p>
        <div className="text-3xl font-semibold text-zinc-950 dark:text-zinc-50">{value}</div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{subtitle}</p>
      </div>
      <div className="flex items-center justify-between gap-2 pt-4"><AppIcon name="arrow" className="order-last h-4 w-4 shrink-0 text-emerald-600 rtl:rotate-180" />
        <span className="text-sm font-medium text-zinc-900 underline-offset-4 group-hover:underline dark:text-zinc-100">
          {cta}
        </span>
      </div>
    </Link>
  );
}

export default function AdminDashboardOverview() {
  const t = useTranslations("admin.dashboard");
  const params = useParams<{ locale: string }>();
  const locale = params?.locale ?? "en";
  const baseHref = `/${locale}/admin`;
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const res = await fetch("/api/admin/dashboard", { credentials: "include" });
        if (!res.ok) throw new Error(t("errors.load"));
        const json = (await res.json()) as DashboardResponse;
        if (isMounted) setData(json);
      } catch (err) {
        if (isMounted) setError(err instanceof Error ? err.message : t("errors.load"));
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const cards = useMemo<CardProps[]>(() => {
    if (!data) return [] as CardProps[];
    const readyLabel = `${data.payPeriods.currentReady} of ${data.payPeriods.totalEmployees}`;
    const absenceSubtitle = t("cards.absences.subtitle", {
      awayNow: data.absences.awayNow,
      upcoming: data.absences.upcoming,
    });

    return [
      {
        title: t("cards.employees.title"), icon: "users",
        value: String(data.employees.total),
        subtitle: t("cards.employees.subtitle"),
        href: `${baseHref}/employees`,
        cta: t("cards.employees.cta"),
      },
      {
        title: t("cards.absences.title"), icon: "calendar",
        value: String(data.absences.awayNow),
        subtitle: absenceSubtitle,
        href: `${baseHref}/absences`,
        cta: t("cards.absences.cta"),
      },
      {
        title: t("cards.essentials.title"), icon: "basket",
        value: String(data.essentials.neededSoon),
        subtitle: t("cards.essentials.subtitle"),
        href: `${baseHref}/essentials`,
        cta: t("cards.essentials.cta"),
      },
      {
        title: t("cards.todos.title"), icon: "tasks",
        value: String(data.todos.open),
        subtitle: t("cards.todos.subtitle"),
        href: `${baseHref}/todos`,
        cta: t("cards.todos.cta"),
      },
      {
        title: t("cards.payPeriods.title"), icon: "wallet",
        value: readyLabel,
        subtitle: t("cards.payPeriods.subtitle"),
        href: `${baseHref}/employees`,
        cta: t("cards.payPeriods.cta"),
      },
    ];
  }, [data, baseHref, t]);

  return (
    <section className="space-y-6">
      <div className="hh-page-heading space-y-2">
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{t("title")}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {t("subtitle")}
        </p>
      </div>

      {!data && !error && (
        <div className="space-y-8">
          <div className="hh-summary-grid grid grid-cols-2 gap-3 lg:grid-cols-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={`card-skeleton-${index}`}
                className="flex h-full animate-pulse flex-col justify-between rounded-2xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-950"
              >
                <div className="space-y-3">
                  <div className="h-3 w-24 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                  <div className="h-8 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                  <div className="h-3 w-40 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                </div>
                <div className="flex items-center justify-between gap-2 pt-4"><AppIcon name="arrow" className="order-last h-4 w-4 shrink-0 text-emerald-600 rtl:rotate-180" />
                  <div className="h-3 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                </div>
              </div>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`list-skeleton-${index}`}
                className="animate-pulse rounded-2xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-950"
              >
                <div className="flex items-center justify-between">
                  <div className="h-3 w-24 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                  <div className="h-3 w-16 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                </div>
                <div className="mt-4 space-y-3">
                  {Array.from({ length: 3 }).map((__, rowIndex) => (
                    <div
                      key={`list-row-${index}-${rowIndex}`}
                      className="h-3 w-full rounded-full bg-zinc-200 dark:bg-zinc-800"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-700 dark:text-red-200">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-8">
          <div className="hh-summary-grid grid grid-cols-2 gap-3 lg:grid-cols-3">
            {cards.map((card) => (
              <SummaryCard key={card.title} {...card} />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <DashboardList
              title={t("lists.awayNow.title")}
              href={`${baseHref}/absences`}
              items={data.lists.awayNow.map((item) => ({
                label: item.employee,
                detail: t("lists.awayNow.detail", { date: item.until }),
              }))}
              emptyLabel={t("lists.awayNow.empty")}
            />
            <DashboardList
              title={t("lists.upcoming.title")}
              href={`${baseHref}/absences`}
              items={data.lists.upcoming.map((item) => ({
                label: item.employee,
                detail: t("lists.upcoming.detail", { date: item.start }),
              }))}
              emptyLabel={t("lists.upcoming.empty")}
            />
            <DashboardList
              title={t("lists.todos.title")}
              href={`${baseHref}/todos`}
              items={data.lists.todos.map((item) => ({
                label: item.title,
                detail: item.employee,
              }))}
              emptyLabel={t("lists.todos.empty")}
            />
            <DashboardList
              title={t("lists.essentials.title")}
              href={`${baseHref}/essentials`}
              items={data.lists.essentials.map((item) => ({
                label: item.name,
                detail: t("lists.essentials.employee", { name: item.employee }),
              }))}
              emptyLabel={t("lists.essentials.empty")}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function DashboardList(props: {
  title: string;
  href: string;
  items: { label: string; detail: string }[];
  emptyLabel: string;
}) {
  const t = useTranslations("admin.dashboard");
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-950">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{props.title}</h2>
        <Link
          className="text-xs font-medium text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
          href={props.href}
        >
          {t("viewAll")}
        </Link>
      </div>
      <div className="mt-4 space-y-3 text-sm">
        {props.items.length === 0 && (
          <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-3 py-3 text-zinc-500 dark:border-white/10 dark:bg-zinc-900/40 dark:text-zinc-400">
            {props.emptyLabel}
          </div>
        )}
        {props.items.map((item) => (
          <div key={`${item.label}-${item.detail}`} className="flex items-center justify-between gap-3">
            <span className="truncate text-zinc-900 dark:text-zinc-100">{item.label}</span>
            <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">{item.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
