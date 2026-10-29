import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { syncUnifiEvents } from "@/server/unifi/sync";
import { sendDailyNotificationDigests } from "@/server/notifications/digest";

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const unifiSyncQueue = new Queue("unifi-sync", { connection });

async function main() {
  const worker = new Worker(
    "unifi-sync",
    async (job) => {
      console.log(`[worker] unifi-sync job=${job.id} name=${job.name}`);
      const res = await syncUnifiEvents();
      console.log(`[worker] unifi-sync processed=${res.processed} inserted=${res.inserted}`);
      return res;
    },
    { connection },
  );
  await worker.waitUntilReady();

  const scheduleDailyDigest = () => {
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 0, 0);
    const delay = next.getTime() - now.getTime();
    setTimeout(async () => {
      try {
        await sendDailyNotificationDigests(process.env.APP_ORIGIN ?? null);
      } catch (err) {
        console.error("[worker] digest error", err);
      }
      setInterval(async () => {
        try {
          await sendDailyNotificationDigests(process.env.APP_ORIGIN ?? null);
        } catch (err) {
          console.error("[worker] digest error", err);
        }
      }, 24 * 60 * 60 * 1000);
    }, delay);
  };

  scheduleDailyDigest();

  console.log("[worker] started");
}

void main();
