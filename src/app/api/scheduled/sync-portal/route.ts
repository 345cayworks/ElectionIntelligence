import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit/log";
import { getSessionUser } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/permissions";
import {
  fetchCandidatesPage,
  fetchPollingStationsPage,
  parseCandidatesPage,
  parsePollingStationsPage,
} from "@/lib/elections-portal/scraper";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Scheduled scraper for portal.elections.ky. Two trigger paths:
//
//   1. Scheduled invocation from Netlify - the function caller sets
//      `X-Sync-Token` to the SCHEDULED_SYNC_TOKEN env value. If that
//      env var is not configured, scheduled invocation is rejected.
//   2. Manual run from a SuperAdmin in the browser - any signed-in
//      SuperAdmin session is allowed (useful for "kick the scraper"
//      diagnostics from the admin UI without juggling a token).
//
// The portal is behind Cloudflare and frequently returns 403 to non-
// browser clients. When that happens we record a single audit log entry
// with severity WARN and return 200 + a summary - this is expected and
// not an outage of our platform.

interface SyncSummary {
  startedAt: string;
  candidatesFetched: { ok: boolean; status: number; parsed: number | null; reason?: string };
  pollingStationsFetched: { ok: boolean; status: number; parsed: number | null; reason?: string };
  candidatesUpserted: number;
  pollingStationsUpserted: number;
  warnings: string[];
}

async function authorize(req: NextRequest): Promise<{ ok: true; mode: "token" | "session"; userId?: string } | { ok: false; status: number; reason: string }> {
  const expected = (process.env.SCHEDULED_SYNC_TOKEN ?? "").trim();
  const provided = req.headers.get("x-sync-token");
  if (expected.length >= 16 && provided && provided === expected) {
    return { ok: true, mode: "token" };
  }

  const user = await getSessionUser();
  if (user && isSuperAdmin(user)) {
    return { ok: true, mode: "session", userId: user.id };
  }

  return { ok: false, status: 401, reason: "unauthorized" };
}

async function syncCandidates(
  warnings: string[],
): Promise<{ status: number; parsed: number | null; ok: boolean; reason?: string; upserted: number }> {
  const fetched = await fetchCandidatesPage();
  if (!fetched.ok || !fetched.html) {
    warnings.push(`candidates: fetch failed (${fetched.reason ?? "unknown"})`);
    return { status: fetched.status, parsed: null, ok: false, reason: fetched.reason, upserted: 0 };
  }
  const scraped = parseCandidatesPage(fetched.html);
  if (!scraped || scraped.length === 0) {
    warnings.push("candidates: 0 rows parsed - portal layout may have changed");
    return { status: fetched.status, parsed: 0, ok: false, reason: "parse_failed", upserted: 0 };
  }
  // We do NOT auto-create candidate rows from scraped data because each
  // candidate is bound to an ElectionCycle + Constituency + shorthandCode,
  // and shorthandCode isn't published on the portal. Instead, we snapshot
  // the scraped list into a PlatformSetting so a human can review and run
  // the importer with confidence.
  await prisma.platformSetting.upsert({
    where: { key: "portal:candidates:lastScrape" },
    update: {
      value: JSON.stringify({ scrapedAt: new Date().toISOString(), candidates: scraped }),
    },
    create: {
      key: "portal:candidates:lastScrape",
      value: JSON.stringify({ scrapedAt: new Date().toISOString(), candidates: scraped }),
    },
  });
  return { status: fetched.status, parsed: scraped.length, ok: true, upserted: 0 };
}

async function syncPollingStations(
  warnings: string[],
): Promise<{ status: number; parsed: number | null; ok: boolean; reason?: string; upserted: number }> {
  const fetched = await fetchPollingStationsPage();
  if (!fetched.ok || !fetched.html) {
    warnings.push(`polling stations: fetch failed (${fetched.reason ?? "unknown"})`);
    return { status: fetched.status, parsed: null, ok: false, reason: fetched.reason, upserted: 0 };
  }
  const scraped = parsePollingStationsPage(fetched.html);
  if (!scraped || scraped.length === 0) {
    warnings.push("polling stations: 0 rows parsed - portal layout may have changed");
    return { status: fetched.status, parsed: 0, ok: false, reason: "parse_failed", upserted: 0 };
  }

  // Look up constituencies by name (case-insensitive) so we can FK.
  const constituencies = await prisma.constituency.findMany();
  const byNameLower = new Map(constituencies.map((c) => [c.name.toLowerCase(), c]));

  let upserted = 0;
  for (const station of scraped) {
    const constituency = byNameLower.get(station.constituency.toLowerCase());
    if (!constituency) {
      warnings.push(`polling station "${station.name}": no matching constituency "${station.constituency}"`);
      continue;
    }
    try {
      const existing = await prisma.pollingStation.findFirst({
        where: { constituencyId: constituency.id, name: station.name },
      });
      if (existing) {
        await prisma.pollingStation.update({
          where: { id: existing.id },
          data: { address: station.address ?? existing.address },
        });
      } else {
        await prisma.pollingStation.create({
          data: {
            constituencyId: constituency.id,
            name: station.name,
            address: station.address ?? null,
          },
        });
      }
      upserted += 1;
    } catch (err) {
      warnings.push(`polling station "${station.name}": upsert failed (${(err as Error).message})`);
    }
  }
  return { status: fetched.status, parsed: scraped.length, ok: true, upserted };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await authorize(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  const summary: SyncSummary = {
    startedAt: new Date().toISOString(),
    candidatesFetched: { ok: false, status: 0, parsed: null },
    pollingStationsFetched: { ok: false, status: 0, parsed: null },
    candidatesUpserted: 0,
    pollingStationsUpserted: 0,
    warnings: [],
  };

  const candidates = await syncCandidates(summary.warnings);
  summary.candidatesFetched = {
    ok: candidates.ok,
    status: candidates.status,
    parsed: candidates.parsed,
    reason: candidates.reason,
  };
  summary.candidatesUpserted = candidates.upserted;

  const stations = await syncPollingStations(summary.warnings);
  summary.pollingStationsFetched = {
    ok: stations.ok,
    status: stations.status,
    parsed: stations.parsed,
    reason: stations.reason,
  };
  summary.pollingStationsUpserted = stations.upserted;

  await recordAudit({
    actorUserId: auth.mode === "session" ? auth.userId ?? null : null,
    action: "elections_portal.sync",
    metadata: {
      mode: auth.mode,
      candidatesParsed: summary.candidatesFetched.parsed,
      stationsParsed: summary.pollingStationsFetched.parsed,
      stationsUpserted: summary.pollingStationsUpserted,
      warnings: summary.warnings.length,
    },
    severity: summary.warnings.length > 0 ? "WARN" : "INFO",
  }).catch(() => {
    /* audit failure must not block the response */
  });

  return NextResponse.json(summary);
}

export async function GET(): Promise<NextResponse> {
  // Returns the last cached snapshot for visibility from /admin/elections.
  const setting = await prisma.platformSetting.findUnique({
    where: { key: "portal:candidates:lastScrape" },
  });
  return NextResponse.json(
    setting
      ? { lastScrape: JSON.parse(setting.value), updatedAt: setting.updatedAt }
      : { lastScrape: null, updatedAt: null },
  );
}
