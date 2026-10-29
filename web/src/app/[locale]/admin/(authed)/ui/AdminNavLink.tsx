"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const baseClassName =
  "inline-flex min-h-10 items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/30 dark:focus-visible:ring-white/40";
const idleClassName =
  "text-zinc-700 hover:bg-zinc-900/10 dark:text-zinc-200 dark:hover:bg-white/10";
const activeClassName =
  "bg-emerald-700 text-white shadow-sm dark:bg-emerald-400 dark:text-zinc-950";

function isActivePath(pathname: string, href: string) {
  return pathname === href || (!/\/admin$/.test(href) && pathname.startsWith(`${href}/`));
}

export default function AdminNavLink(props: { href: string; label: string }) {
  const pathname = usePathname();
  const active = isActivePath(pathname, props.href);

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`${baseClassName} ${active ? activeClassName : idleClassName}`}
      href={props.href}
    >
      {props.label}
    </Link>
  );
}
