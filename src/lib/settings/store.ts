import { prisma } from "@/lib/db";

// Lightweight key/value settings store backed by PlatformSetting.

export async function getSetting<T = unknown>(key: string, fallback: T): Promise<T> {
  const row = await prisma.platformSetting.findUnique({ where: { key } });
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

export async function setSetting(
  key: string,
  value: unknown,
  updatedBy?: string,
): Promise<void> {
  const serialized = JSON.stringify(value);
  await prisma.platformSetting.upsert({
    where: { key },
    update: { value: serialized, updatedBy: updatedBy ?? null },
    create: { key, value: serialized, updatedBy: updatedBy ?? null },
  });
}

export const SETTING_KEYS = {
  TRACKING_ENABLED: "tracking.enabled",
  TRACKING_GA_ID: "tracking.ga_measurement_id",
  TRACKING_GTM_ID: "tracking.google_tag_id",
  TRACKING_META_ID: "tracking.meta_pixel_id",
  ADS_ENABLED: "ads.enabled",
  ADS_BASE_URL: "ads.base_url",
  ADS_PLATFORM: "ads.platform",
  RETENTION_AUDIT_DAYS: "retention.audit_log_days",
  RETENTION_VISIT_DAYS: "retention.visit_days",
} as const;
