import { normalizeUnifiHost, type UnifiConfig } from "@/lib/unifi/config";
import { getPrisma } from "@/server/db/prisma";
import { decryptString, encryptString } from "@/server/security/encryption";

const UNIFI_KEY = "unifi-config";

type StoredConfig = UnifiConfig;

export async function saveUnifiConfig(config: UnifiConfig): Promise<void> {
  const prisma = getPrisma();
  const normalized: StoredConfig = {
    ...config,
    host: normalizeUnifiHost(config.host),
    token: config.token.trim(),
    tlsVerify: Boolean(config.tlsVerify),
  };
  const encrypted = encryptString(JSON.stringify(normalized));
  await prisma.appSetting.upsert({
    where: { key: UNIFI_KEY },
    create: { key: UNIFI_KEY, value: encrypted },
    update: { value: encrypted },
  });
}

export async function getUnifiConfig(): Promise<UnifiConfig | null> {
  const prisma = getPrisma();
  const row = await prisma.appSetting.findUnique({ where: { key: UNIFI_KEY } });
  if (!row) return null;
  try {
    const parsed = JSON.parse(decryptString(row.value)) as StoredConfig;
    return parsed;
  } catch (err) {
    console.error("Failed to decrypt UniFi config", err);
    return null;
  }
}

export async function getUnifiConfigSummary(): Promise<{
  host: string | null;
  tlsVerify: boolean | null;
  hasToken: boolean;
  attendance: NonNullable<UnifiConfig["attendance"]> | null;
  webhookConfigured: boolean;
  lastWebhookReceivedAt: string | null;
}> {
  const cfg = await getUnifiConfig();
  if (!cfg) return { host: null, tlsVerify: null, hasToken: false, attendance: null, webhookConfigured: false, lastWebhookReceivedAt: null };
  const delivery=await getPrisma().appSetting.findUnique({where:{key:"unifi-protect-last-delivery"}});
  return { lastWebhookReceivedAt: delivery?.value ?? null, host: cfg.host, tlsVerify: cfg.tlsVerify, hasToken: Boolean(cfg.token), attendance: cfg.attendance ?? null, webhookConfigured: Boolean(cfg.webhookSecret) };
}

export async function requireUnifiConfig(): Promise<UnifiConfig> {
  const cfg = await getUnifiConfig();
  if (!cfg) throw new Error("UniFi config not set");
  return cfg;
}
