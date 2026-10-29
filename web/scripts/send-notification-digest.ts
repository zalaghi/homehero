import { sendDailyNotificationDigests } from "../src/server/notifications/digest";

async function main() {
  const appOrigin = process.env.APP_ORIGIN ?? null;
  await sendDailyNotificationDigests(appOrigin);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
