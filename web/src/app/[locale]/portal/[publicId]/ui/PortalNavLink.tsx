"use client";

import Link from "next/link";
import AppIcon, { type IconName } from "@/components/AppIcon";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

type Variant = "header" | "bottom";

type PortalNavLinkProps = {
  href: string;
  label: string;
  icon?: IconName;
  variant: Variant;
  showDot?: boolean;
};

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function PortalNavLink(props: PortalNavLinkProps) {
  const pathname = usePathname() ?? "";
  const isActive = useMemo(() => isActivePath(pathname, props.href), [pathname, props.href]);

  const baseClasses =
    "touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950";

  if (props.variant === "bottom") {
    return (
      <Link
        href={props.href}
        aria-current={isActive ? "page" : undefined}
        className={`hh-nav-item relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 overflow-visible rounded-2xl px-1 py-2 text-[10px] font-semibold ${baseClasses} ${
          isActive
            ? "hh-nav-active text-emerald-800 dark:text-emerald-200"
            : "text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10"
        }`}
      >
        {props.icon ? <AppIcon name={props.icon} className="h-5 w-5 shrink-0" /> : null}
        {props.showDot ? (
          <span
            aria-hidden="true"
            className="absolute right-2 top-2 h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.25)]"
          />
        ) : null}
        <span className="max-w-full truncate">{props.label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={props.href}
      aria-current={isActive ? "page" : undefined}
      className={`rounded-md px-3 py-2 text-sm font-medium transition ${baseClasses} ${
        isActive
          ? "bg-black/5 text-zinc-900 dark:bg-white/10 dark:text-white"
          : "text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10"
      }`}
    >
      <span className="relative inline-flex items-center gap-2">
        {props.label}
        {props.showDot ? (
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.2)]"
          />
        ) : null}
      </span>
    </Link>
  );
}
