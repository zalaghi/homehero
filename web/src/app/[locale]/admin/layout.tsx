import type { Metadata, Viewport } from "next";
import AdminPwaSetup from "./ui/AdminPwaSetup";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    manifest: `/${locale}/admin/manifest.webmanifest`,
    appleWebApp: {
      capable: true,
      title: "HomeHero Admin",
      statusBarStyle: "default",
    },
    icons: {
      icon: [{ url: "/pwa/admin/icon-192.png", sizes: "192x192", type: "image/png" }],
      apple: [{ url: "/pwa/admin/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#3149bf",
  viewportFit: "cover",
};

// Include the login screen so installing before sign-in also creates the admin app.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <><AdminPwaSetup />{children}</>;
}
