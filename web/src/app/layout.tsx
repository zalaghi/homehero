import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { defaultLocale, isRtlLocale, locales, type AppLocale } from "@/i18n/routing";
import { getBrandingSettings } from "@/server/branding/settings";

export const viewport = {
  themeColor: "#0b1220",
};

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getBrandingSettings();
  const iconUrl = branding.iconUrl ?? "/icon.svg";
  return {
    title: {
      default: branding.appName,
      template: `%s · ${branding.appName}`,
    },
    description: "HomeHero payroll, attendance, deductions, and receipts.",
    manifest: "/manifest.webmanifest",
    icons: {
      icon: iconUrl,
      apple: iconUrl,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("NEXT_LOCALE")?.value;
  const locale: AppLocale =
    localeCookie && locales.includes(localeCookie as AppLocale)
      ? (localeCookie as AppLocale)
      : defaultLocale;
  const dir = isRtlLocale(locale) ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
