import { processPushOutbox } from "../server/notifications/delivery";
import { getPrisma } from "../server/db/prisma";
import { processWeeklyPayrollEmails } from "../server/payroll/weeklyEmail";
let stopping = false;
let weeklyRunning = false, lastWeekly = 0;
process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });
async function main() {
  console.log("[push-worker] started");
  while (!stopping) {
    if (!weeklyRunning && Date.now() - lastWeekly >= 60000) {
      weeklyRunning = true; lastWeekly = Date.now();
      void processWeeklyPayrollEmails().catch(() => console.error("[worker] weekly email cycle failed")).finally(() => { weeklyRunning = false; });
    }
    try {
      const result = await processPushOutbox();
      await getPrisma().appSetting.upsert({ where: { key: "push.workerHeartbeat" }, create: { key: "push.workerHeartbeat", value: new Date().toISOString() }, update: { value: new Date().toISOString() } });
      if (result.processed) console.log(`[push-worker] processed=${result.processed}`);
    } catch { console.error("[push-worker] cycle failed; retrying"); }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  while (weeklyRunning) await new Promise(resolve => setTimeout(resolve, 100));
  await getPrisma().$disconnect();
}
void main().catch(() => { process.exitCode = 1; });
