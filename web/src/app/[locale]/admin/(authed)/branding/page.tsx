import { getTranslations } from "next-intl/server";
import BrandingPanel from "./ui/BrandingPanel";

export default async function AdminBrandingPage() {
  const t = await getTranslations("admin.branding");
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("subtitle")}</p>
      </div>
      <BrandingPanel />
    </div>
  );
}
