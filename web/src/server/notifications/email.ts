import nodemailer from "nodemailer";

type NotificationEmailConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
};

function getNotificationEmailConfig(): NotificationEmailConfig | null {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const fromEmail = process.env.NOTIFY_FROM_EMAIL ?? process.env.SMTP_USER;
  const fromName = process.env.NOTIFY_FROM_NAME ?? "HomeHero";

  if (!host || !user || !pass || !fromEmail) return null;

  return { host, port, user, pass, fromEmail, fromName };
}

export async function sendNotificationEmail(input: {
  to: string;
  subject: string;
  body: string;
  html?: string;
}): Promise<boolean> {
  const config = getNotificationEmailConfig();
  if (!config) return false;

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: false,
    auth: { user: config.user, pass: config.pass },
  });

  await transporter.sendMail({
    from: `${config.fromName} <${config.fromEmail}>`,
    to: input.to,
    subject: input.subject,
    text: input.body,
    html: input.html,
  });

  return true;
}
