import { getPrisma } from "@/server/db/prisma";
import { sendNotificationEmail } from "@/server/notifications/email";
import { shouldSendNotificationEmail } from "@/server/notifications/rules";
import { buildDigestEmail } from "@/server/notifications/templates";

type DigestEmployee = {
  id: string;
  email: string;
  locale: string;
  publicId: string;
};

export async function sendDailyNotificationDigests(appOrigin: string | null = null) {
  const prisma = getPrisma();
  const employees = await prisma.employee.findMany({
    where: { email: { not: null } },
    select: { id: true, email: true, locale: true, publicId: true },
  });

  for (const employee of employees.filter((item): item is DigestEmployee => !!item.email)) {
    const pending = await prisma.employeeNotification.findMany({
      where: {
        employeeId: employee.id,
        readAt: null,
        clickedAt: null,
        emailSentAt: null,
      },
      orderBy: { createdAt: "asc" },
    });
    const eligible = pending.filter((item) =>
      shouldSendNotificationEmail({
        readAt: item.readAt,
        clickedAt: item.clickedAt,
        emailSentAt: item.emailSentAt,
      }),
    );
    if (!eligible.length || !employee.email) continue;

    const portalLink = appOrigin
      ? `${appOrigin}/${employee.locale || "en"}/portal/${employee.publicId}/notifications`
      : null;

    const digest = buildDigestEmail({
      locale: employee.locale === "es" ? "es" : "en",
      notifications: eligible.map((item) => ({
        createdAt: item.createdAt,
        title: item.title,
        body: item.body,
        type: item.type,
        link: portalLink,
      })),
      appOrigin,
    });

    const sent = await sendNotificationEmail({
      to: employee.email,
      subject: digest.subject,
      body: digest.text,
      html: digest.html,
    });

    if (sent) {
      await prisma.employeeNotification.updateMany({
        where: { id: { in: eligible.map((item) => item.id) } },
        data: { emailSentAt: new Date() },
      });
    }
  }
}
