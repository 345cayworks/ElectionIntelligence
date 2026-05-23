// Centralized environment variable access.
// Reads only on the server. Never re-exports secret values to the browser.

const truthy = (v: string | undefined) =>
  v === "true" || v === "1" || v === "yes" || v === "on";

export const env = {
  // App
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Election Intelligence",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",

  // Tracking (public)
  tracking: {
    enabled: truthy(process.env.NEXT_PUBLIC_ENABLE_TRACKING),
    gaMeasurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "",
    googleTagId: process.env.NEXT_PUBLIC_GOOGLE_TAG_ID ?? "",
    metaPixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "",
  },

  // SuperAdmin bootstrap (server-only)
  superAdmin: {
    email: process.env.SUPER_ADMIN_EMAIL ?? "",
    // SUPERADMIN_MASTER_KEY is intentionally NOT exposed as a constant.
    // Access it only via the dedicated helper in lib/auth/superadmin-key.ts.
  },

  // Ads (server-only)
  ads: {
    publicEnabled: truthy(process.env.NEXT_PUBLIC_ENABLE_ADS),
    baseUrl: process.env.AD_ENGINE_BASE_URL ?? "https://ads.cayworks.com",
    platform: process.env.AD_ENGINE_PLATFORM ?? "election-intelligence",
  },
};

// Public env shape - safe to ship to browser.
export const publicEnv = {
  appName: env.appName,
  appUrl: env.appUrl,
  tracking: env.tracking,
  adsEnabled: env.ads.publicEnabled,
};

// Server-only helpers that report configuration status without leaking values.
export const isSuperAdminEmailConfigured = () =>
  Boolean(process.env.SUPER_ADMIN_EMAIL && process.env.SUPER_ADMIN_EMAIL.length > 0);

export const isSuperAdminMasterKeyConfigured = () =>
  Boolean(
    process.env.SUPERADMIN_MASTER_KEY &&
      process.env.SUPERADMIN_MASTER_KEY.length >= 16,
  );

export const isAdEngineKeyConfigured = () =>
  Boolean(process.env.AD_ENGINE_KEY && process.env.AD_ENGINE_KEY.length > 0);

export const isAdEngineBaseUrlConfigured = () =>
  Boolean(process.env.AD_ENGINE_BASE_URL && process.env.AD_ENGINE_BASE_URL.length > 0);

export const isAdEnginePlatformConfigured = () =>
  Boolean(process.env.AD_ENGINE_PLATFORM && process.env.AD_ENGINE_PLATFORM.length > 0);
