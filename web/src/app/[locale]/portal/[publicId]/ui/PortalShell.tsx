"use client";

import { useTranslations } from "next-intl";
import PortalHeader from "./PortalHeader";
import PortalNavLink from "./PortalNavLink";
import { useNotifications } from "./notifications/NotificationProvider";
import PortalRememberCode from "./PortalRememberCode";

export default function PortalShell(props: {
  publicId: string;
  locale: string;
  appName: string;
  logoUrl: string | null;
  children: React.ReactNode;
}) {
  const t = useTranslations("portal.navigation");
  const { unreadByType } = useNotifications();
  return (
    <div dir={props.locale === "fa" ? "rtl" : "ltr"} className="portal-shell hh-page min-h-dvh overscroll-y-none text-zinc-950 dark:text-zinc-50">
      <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+5rem)] pt-[calc(env(safe-area-inset-top)+1rem)] sm:px-6 sm:pb-8 sm:pt-6">
        <PortalRememberCode publicId={props.publicId} />
        <PortalHeader
          publicId={props.publicId}
          locale={props.locale}
          appName={props.appName}
          logoUrl={props.logoUrl}
        />
        <div className="hh-content mt-6 min-w-0 flex-1">{props.children}</div>
      </div>

      <nav className="hh-bottom-nav fixed bottom-0 inset-x-0 z-30 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 sm:hidden">
        <div className="mx-auto grid max-w-3xl grid-cols-5 gap-1 px-2">
          <PortalNavLink
            href={`/${props.locale}/portal/${props.publicId}/dashboard`}
            label={t("dashboard")}
            icon="home"
            variant="bottom"
          />
          <PortalNavLink
            href={`/${props.locale}/portal/${props.publicId}/attendance`}
            label={t("attendance")}
            icon="calendar"
            variant="bottom"
            showDot={(unreadByType.WEEKEND_REQUEST_DECISION ?? 0) > 0}
          />
          <PortalNavLink
            href={`/${props.locale}/portal/${props.publicId}/pay-periods`}
            label={t("pay")}
            icon="wallet"
            variant="bottom"
          />
          <PortalNavLink
            href={`/${props.locale}/portal/${props.publicId}/todos`}
            label={t("todos")}
            icon="tasks"
            variant="bottom"
            showDot={(unreadByType.TODO_ASSIGNED ?? 0) > 0}
          />
          <PortalNavLink
            href={`/${props.locale}/portal/${props.publicId}/essentials`}
            label={t("essentials")}
            icon="basket"
            variant="bottom"
            showDot={(unreadByType.ESSENTIALS_UPDATED ?? 0) > 0}
          />
        </div>
      </nav>
    </div>
  );
}
