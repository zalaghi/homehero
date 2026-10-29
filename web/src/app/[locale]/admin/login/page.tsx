import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/server/auth/session";
import AdminLoginForm from "../ui/AdminLoginForm";

export default async function AdminLoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const user = await getCurrentUser();
  const { locale } = await params;
  const t = await getTranslations("admin.login");
  if (user?.role === "ADMIN") redirect(`/${locale}/admin`);

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {t("subtitle")}
      </p>
      <div className="mt-6">
        <AdminLoginForm />
      </div>
    </div>
  );
}
