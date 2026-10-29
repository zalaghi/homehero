import { getTranslations } from "next-intl/server";
import EssentialsPanel from "./ui/EssentialsPanel";

export default async function AdminEssentialsPage() {
  const t = await getTranslations("admin.essentials");
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {t("subtitle")}
        </p>
      </div>
      <EssentialsPanel />
    </div>
  );
}
