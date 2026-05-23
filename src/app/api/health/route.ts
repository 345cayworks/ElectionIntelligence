import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  env,
  isAdEngineKeyConfigured,
  isSuperAdminEmailConfigured,
  isSuperAdminMasterKeyConfigured,
} from "@/lib/env";

export const dynamic = "force-dynamic";

// Public-safe diagnostic endpoint. Never returns secret values - only
// "configured" / "missing" booleans and connectivity status. Useful for
// confirming a deployment is ready BEFORE attempting to sign in.

interface HealthCheck {
  ok: boolean;
  status: "ok" | "warn" | "fail";
  detail?: string;
}

async function checkDatabase(): Promise<HealthCheck> {
  try {
    // Touch the User table - this verifies DATABASE_URL is set, the
    // database is reachable, AND the schema has been applied.
    const count = await prisma.user.count();
    return {
      ok: true,
      status: "ok",
      detail: `${count} user(s)`,
    };
  } catch (err) {
    const code = (err as { code?: string }).code;
    const reason =
      code === "P2021"
        ? "schema_not_applied"
        : code === "P1001" || code === "P1003"
          ? "unreachable"
          : code === "P1000"
            ? "auth_failed"
            : "error";
    return { ok: false, status: "fail", detail: reason };
  }
}

export async function GET() {
  const db = await checkDatabase();

  const bootstrap: HealthCheck = isSuperAdminEmailConfigured()
    ? { ok: true, status: "ok" }
    : { ok: false, status: "warn", detail: "SUPER_ADMIN_EMAIL not set" };

  const masterKey: HealthCheck = isSuperAdminMasterKeyConfigured()
    ? { ok: true, status: "ok" }
    : { ok: false, status: "warn", detail: "SUPERADMIN_MASTER_KEY not set (>=16 chars)" };

  // Ads are optional. If the public toggle is off, key absence is fine.
  // If the toggle is on but the key is missing, that's a warning.
  let ads: HealthCheck;
  if (!env.ads.publicEnabled) {
    ads = { ok: true, status: "ok", detail: "ads disabled" };
  } else if (isAdEngineKeyConfigured()) {
    ads = { ok: true, status: "ok" };
  } else {
    ads = { ok: false, status: "warn", detail: "NEXT_PUBLIC_ENABLE_ADS is true but AD_ENGINE_KEY is missing" };
  }

  let tracking: HealthCheck;
  if (!env.tracking.enabled) {
    tracking = { ok: true, status: "ok", detail: "tracking disabled" };
  } else {
    const anyId =
      env.tracking.gaMeasurementId.length > 0 ||
      env.tracking.googleTagId.length > 0 ||
      env.tracking.metaPixelId.length > 0;
    tracking = anyId
      ? { ok: true, status: "ok" }
      : { ok: false, status: "warn", detail: "tracking enabled but no IDs set" };
  }

  // Overall: fail if any required check fails (database, primarily).
  const overall = db.status === "fail" ? "fail" : "ok";

  return NextResponse.json(
    {
      overall,
      checks: {
        database: db,
        super_admin_email: bootstrap,
        super_admin_master_key: masterKey,
        ads_engine: ads,
        tracking,
      },
      env: {
        ad_engine_base_url: env.ads.baseUrl,
        ad_engine_platform: env.ads.platform,
        node_env: process.env.NODE_ENV ?? null,
      },
    },
    { status: overall === "fail" ? 503 : 200 },
  );
}
