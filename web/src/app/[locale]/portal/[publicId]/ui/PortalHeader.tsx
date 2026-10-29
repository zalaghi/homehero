"use client";

import Image from "next/image";
import AppIcon from "@/components/AppIcon";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import PortalNavLink from "./PortalNavLink";
import { useNotifications } from "./notifications/NotificationProvider";

type Profile = {
  publicId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  avatarUrl: string | null;
};

export default function PortalHeader(props: {
  publicId: string;
  locale: string;
  appName: string;
  logoUrl: string | null;
}) {
  const t = useTranslations("portal.header");
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const { unreadCount, unreadByType, markTypeRead, refresh } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/employee/profile", { credentials: "include" });
      const data = (await res.json().catch(() => null)) as Profile | { error?: string } | null;
      if (!res.ok || !data || "error" in data) return;
      setProfile(data as Profile);
    }

    void load();
  }, []);

  useEffect(() => {
    const sectionTypeMap: Record<string, "WEEKEND_REQUEST_DECISION" | "TODO_ASSIGNED" | "ESSENTIALS_UPDATED"> = {
      attendance: "WEEKEND_REQUEST_DECISION",
      todos: "TODO_ASSIGNED",
      essentials: "ESSENTIALS_UPDATED",
    };
    const sectionKey = Object.keys(sectionTypeMap).find((key) => pathname.includes(`/${key}`));
    if (!sectionKey) return;
    const type = sectionTypeMap[sectionKey];
    if (!unreadByType[type]) return;
    void markTypeRead(type);
  }, [markTypeRead, pathname, unreadByType]);

  const initials = useMemo(() => {
    if (!profile) return "";
    return `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase();
  }, [profile]);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refresh(true);
      router.refresh();
    } finally {
      setTimeout(() => setRefreshing(false), 600);
    }
  };

  return (
    <div className="hh-portal-header">
      <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {props.logoUrl ? (
              <Image
                src={props.logoUrl}
                alt={props.appName}
                width={36}
                height={36}
                className="h-9 w-9 rounded-md border border-black/10 object-cover dark:border-white/10"
                unoptimized
              />
            ) : <span className="hh-brand-icon"><AppIcon name="home" className="h-5 w-5" /></span>}
            <div className="min-w-0">
              <div className="hh-brand-caption truncate text-[10px] font-semibold uppercase tracking-[.14em] text-zinc-500 dark:text-zinc-400">
                {t("quickOverview")}
              </div>
              <div className="truncate text-base font-semibold leading-tight">{props.appName}</div>
            </div>
          </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => void handleRefresh()}
            className="touch-manipulation relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-black/10 text-zinc-600 hover:bg-black/5 disabled:opacity-60 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/10"
            aria-label={t("refresh")}
            title={t("refresh")}
            disabled={refreshing}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12a7.5 7.5 0 0 1 12.7-5.3l1.3-1.3v4.5h-4.5l1.6-1.6A5.5 5.5 0 1 0 17.5 14"
              />
            </svg>
          </button>
          <a
            href={`/${props.locale}/portal/${props.publicId}/notifications`}
            className="touch-manipulation relative flex h-11 w-11 shrink-0 items-center justify-center overflow-visible rounded-full border border-black/10 text-zinc-600 hover:bg-black/5 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/10"
            aria-label={t("nav.notifications")}
            title={t("nav.notifications")}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.5 17h3l-1.6-1.6A2 2 0 0 1 16.5 14V10a4.5 4.5 0 1 0-9 0v4a2 2 0 0 1-.4 1.4L5.5 17h10z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 17a2.5 2.5 0 0 0 5 0" />
            </svg>
            {unreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 z-10 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[0.6rem] font-semibold text-white shadow-sm">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </a>
          {profile?.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={t("avatarAlt")}
              className="hh-profile-avatar h-9 w-9 rounded-full object-cover ring-2 ring-emerald-500/20"
            />
          ) : (
            <div className="hh-profile-avatar flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-sm font-semibold text-white">
              {initials || <AppIcon name="users" className="h-4 w-4" />}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 hidden flex-wrap gap-2 sm:flex">
        <PortalNavLink
          href={`/${props.locale}/portal/${props.publicId}/dashboard`}
          label={t("nav.dashboard")}
          variant="header"
        />
        <PortalNavLink
          href={`/${props.locale}/portal/${props.publicId}/attendance`}
          label={t("nav.attendance")}
          variant="header"
          showDot={(unreadByType.WEEKEND_REQUEST_DECISION ?? 0) > 0}
        />
        <PortalNavLink
          href={`/${props.locale}/portal/${props.publicId}/pay-periods`}
          label={t("nav.payPeriods")}
          variant="header"
        />
        <PortalNavLink
          href={`/${props.locale}/portal/${props.publicId}/todos`}
          label={t("nav.todos")}
          variant="header"
          showDot={(unreadByType.TODO_ASSIGNED ?? 0) > 0}
        />
        <PortalNavLink
          href={`/${props.locale}/portal/${props.publicId}/essentials`}
          label={t("nav.essentials")}
          variant="header"
          showDot={(unreadByType.ESSENTIALS_UPDATED ?? 0) > 0}
        />
      </div>
    </div>
  );
}
