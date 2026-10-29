import { getTranslations } from "next-intl/server";

export default async function LocalizedHomePage() {
  const t = await getTranslations("home");

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto flex max-w-3xl flex-col gap-3 px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-zinc-600 dark:text-zinc-400">{t("subtitle")}</p>
        <div className="mt-6 rounded-xl border border-black/10 bg-white p-4 text-sm dark:border-white/10 dark:bg-zinc-950">
          <div className="font-medium">Next steps</div>
          <ul className="mt-2 list-disc pl-5 text-zinc-700 dark:text-zinc-300">
            <li>Admin: /admin (coming next)</li>
            <li>Employee portal: /portal/&lt;publicId&gt; (coming next)</li>
          </ul>
        </div>
      </main>
    </div>
  );
}

