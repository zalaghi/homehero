import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import AppIcon from "@/components/AppIcon";
import { getCurrentUser } from "@/server/auth/session";
import { getBrandingSettings } from "@/server/branding/settings";
import AdminNav from "./ui/AdminNav";

export default async function AdminAuthedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const user = await getCurrentUser();
  const { locale } = await params;
  const t = await getTranslations("admin.layout");
  const branding = await getBrandingSettings();
  if (!user || user.role !== "ADMIN") redirect(`/${locale}/admin/login`);

  return (
    <div dir={locale === "fa" ? "rtl" : "ltr"} className="admin-shell hh-page min-h-screen bg-slate-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="hh-admin-header sticky top-0 z-30">
        <div className="mx-auto flex max-w-7xl flex-col items-stretch gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            {branding.logoUrl ? (
              <Image
                src={branding.logoUrl}
                alt={branding.appName}
                width={28}
                height={28}
                className="rounded"
                unoptimized
              />
            ) : <span className="hh-brand-icon"><AppIcon name="home" className="h-5 w-5" /></span>}
            <div className="text-base font-semibold tracking-tight">{t("title", { appName: branding.appName })}</div>

          </div>
          <nav className="flex items-center justify-end">
            <AdminNav locale={locale} />
          </nav>
        </div>
      </header>
      <main className="hh-admin-main mx-auto w-full min-w-0 max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
