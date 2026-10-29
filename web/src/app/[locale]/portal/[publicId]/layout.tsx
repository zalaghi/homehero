import { getBrandingSettings } from "@/server/branding/settings";
import PortalShell from "./ui/PortalShell";
import PortalPwaSetup from "../ui/PortalPwaSetup";
import { NotificationProvider } from "./ui/notifications/NotificationProvider";
import type { Metadata } from "next";

export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "HomeHero",
  },
  icons: {
    apple: [
      {
        url: "/pwa/apple-touch-icon.png",
        type: "image/png",
      },
    ],
  },
};

export default async function PortalPublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string; publicId: string }>;
}) {
  const { publicId, locale } = await params;
  const branding = await getBrandingSettings();

  return (
    <NotificationProvider>
      <PortalPwaSetup locale={locale} />
      <PortalShell publicId={publicId} locale={locale} appName={branding.appName} logoUrl={branding.logoUrl}>
        {children}
      </PortalShell>
    </NotificationProvider>
  );
}
