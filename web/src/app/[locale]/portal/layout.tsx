import type { Metadata } from "next";
import PortalPwaSetup from "./ui/PortalPwaSetup";

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

export const viewport = {
  viewportFit: "cover",
};

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <>
      <PortalPwaSetup locale={locale} />
      {children}
    </>
  );
}
