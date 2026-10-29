"use client";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import AdminNavLink from "./AdminNavLink";
import Link from "next/link";
import AppIcon, { type IconName } from "@/components/AppIcon";
export default function AdminNav({ locale }: { locale: string }) {
  const t = useTranslations("admin.navigation"), a = useTranslations("admin.actions");
  const path = usePathname(), router = useRouter();
  const [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const links = [["", "dashboard"], ["/employees", "employees"], ["/todos", "todos"], ["/essentials", "essentials"], ["/absences", "absences"], ["/holiday-calendars", "holidayCalendars"], ["/payroll-settings", "payrollSettings"], ["/branding", "branding"], ["/sessions", "sessions"], ["/unifi", "unifi"]];
  const navigation = <>{links.map(([suffix, label]) => <AdminNavLink key={suffix} href={`/${locale}/admin${suffix}`} label={t(label)} />)}</>;
  return <div className="w-full">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="hidden min-w-0 flex-1 flex-wrap gap-1 lg:flex">{navigation}</div>
      <details className="group min-w-0 flex-1 lg:hidden">
        <summary className="w-fit cursor-pointer rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold dark:border-zinc-700"><AppIcon name="menu" className="inline h-4 w-4 me-2" />{a("menu")}</summary>
        <div className="mt-3 grid grid-cols-2 gap-2" onClick={e => { if ((e.target as HTMLElement).closest("a")) e.currentTarget.closest("details")?.removeAttribute("open"); }}>{navigation}</div>
      </details>
      <div className="flex shrink-0 items-center gap-2 self-start">
        <select aria-label={a("language")} value={locale} className="rounded-lg border border-zinc-200 bg-transparent px-2 py-2 text-sm dark:border-zinc-700" onChange={e => router.push(path.replace(`/${locale}`, `/${e.target.value}`))}><option value="en">EN</option><option value="es">ES</option><option value="fa">فارسی</option><option value="de">DE</option></select>
        <button disabled={busy} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700" onClick={async () => { setBusy(true); setError(false); try { const res = await fetch("/api/auth/logout", { method: "POST" }); if (!res.ok) throw new Error(); window.location.assign(`/${locale}/admin/login`); } catch { setError(true); setBusy(false); } }}>{t("signOut")}</button>
      </div>
    </div><nav aria-label={a("menu")} className="hh-bottom-nav fixed bottom-0 inset-x-0 z-30 grid grid-cols-4 gap-1 px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] lg:hidden">{([["", "dashboard", "home"], ["/employees", "employees", "users"], ["/todos", "todos", "tasks"], ["/unifi", "unifi", "camera"]] as const).map(([suffix,label,icon]) => { const href=`/${locale}/admin${suffix}`; const active=path===href || (!!suffix && path.startsWith(href+"/")); return <Link key={suffix} href={href} aria-current={active ? "page" : undefined} className={`hh-nav-item flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-semibold ${active ? "hh-nav-active text-emerald-700 dark:text-emerald-200" : "text-zinc-500 dark:text-zinc-400"}`}><AppIcon name={icon as IconName} className="h-5 w-5" /><span className="max-w-full truncate">{t(label)}</span></Link>; })}</nav>{error && <p role="alert" className="mt-2 text-sm text-red-600">{a("failed")}</p>}
  </div>;
}
