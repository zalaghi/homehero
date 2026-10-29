import type { MetadataRoute } from "next";
import { locales, type AppLocale } from "@/i18n/routing";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  if (!locales.includes(locale as AppLocale)) {
    return new Response("Not found", { status: 404 });
  }

  const manifest: MetadataRoute.Manifest = {
    // Separate installation identity from the existing employee app (/en/portal).
    id: "/admin",
    name: "HomeHero Admin",
    short_name: "HH Admin",
    description: "HomeHero administration: employees, attendance, and weekly pay.",
    lang: locale,
    dir: locale === "fa" ? "rtl" : "ltr",
    start_url: `/${locale}/admin`,
    // Admin routes in all supported languages stay inside the installed window.
    scope: "/",
    display: "standalone",
    background_color: "#3149bf",
    theme_color: "#3149bf",
    icons: [
      { src: "/pwa/admin/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/admin/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/admin/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };

  return Response.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
