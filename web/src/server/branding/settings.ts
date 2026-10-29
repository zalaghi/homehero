import { getPrisma } from "@/server/db/prisma";

export type BrandingSettings = {
  appName: string;
  logoUrl: string | null;
  iconUrl: string | null;
};

const BRANDING_KEYS = {
  appName: "branding.appName",
  logoUrl: "branding.logoUrl",
  iconUrl: "branding.iconUrl",
} as const;

const DEFAULT_BRANDING: BrandingSettings = {
  appName: "HomeHero",
  logoUrl: null,
  iconUrl: null,
};

export async function getBrandingSettings(): Promise<BrandingSettings> {
  const prisma = getPrisma();
  let settings: Array<{ key: string; value: string }> = [];
  try {
    settings = await prisma.appSetting.findMany({
      where: { key: { in: Object.values(BRANDING_KEYS) } },
    });
  } catch {
    return DEFAULT_BRANDING;
  }
  const values = new Map(settings.map((setting) => [setting.key, setting.value]));

  const logoUrl = values.get(BRANDING_KEYS.logoUrl);
  const iconUrl = values.get(BRANDING_KEYS.iconUrl);

  return {
    appName: values.get(BRANDING_KEYS.appName) ?? DEFAULT_BRANDING.appName,
    logoUrl: logoUrl && logoUrl.length > 0 ? logoUrl : DEFAULT_BRANDING.logoUrl,
    iconUrl: iconUrl && iconUrl.length > 0 ? iconUrl : DEFAULT_BRANDING.iconUrl,
  };
}

export async function updateBrandingSettings(input: BrandingSettings): Promise<BrandingSettings> {
  const prisma = getPrisma();
  await prisma.$transaction([
    prisma.appSetting.upsert({
      where: { key: BRANDING_KEYS.appName },
      create: { key: BRANDING_KEYS.appName, value: input.appName },
      update: { value: input.appName },
    }),
    prisma.appSetting.upsert({
      where: { key: BRANDING_KEYS.logoUrl },
      create: { key: BRANDING_KEYS.logoUrl, value: input.logoUrl ?? "" },
      update: { value: input.logoUrl ?? "" },
    }),
    prisma.appSetting.upsert({
      where: { key: BRANDING_KEYS.iconUrl },
      create: { key: BRANDING_KEYS.iconUrl, value: input.iconUrl ?? "" },
      update: { value: input.iconUrl ?? "" },
    }),
  ]);

  return input;
}
