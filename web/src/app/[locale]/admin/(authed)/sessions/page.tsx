import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPrisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";
import SessionTable from "./SessionTable";

export default async function AdminSessionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const user = await getCurrentUser();
  const { locale } = await params;
  const t = await getTranslations("admin.sessions");
  if (!user || user.role !== "ADMIN") redirect(`/${locale}/admin/login`);

  const prisma = getPrisma();
  const sessions = await prisma.session.findMany({
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {t("subtitle")}
        </p>
      </div>
      <SessionTable
        sessions={sessions.map((s) => ({
          id: s.id,
          userId: s.userId,
          email: s.user.email ?? "(unknown)",
          role: s.user.role,
          createdAt: s.createdAt.toISOString(),
          expiresAt: s.expiresAt.toISOString(),
          revokedAt: s.revokedAt?.toISOString() ?? null,
          lastSeenAt: s.lastSeenAt.toISOString(),
          ip: s.ip,
          userAgent: s.userAgent,
        }))}
      />
    </div>
  );
}
