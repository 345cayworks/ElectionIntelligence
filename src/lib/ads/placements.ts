// Registered placement keys. Only these are exposed via internal proxy.
import { prisma } from "@/lib/db";
import { DEFAULT_AD_PLACEMENTS } from "@/lib/constants";

export interface PlacementInfo {
  key: string;
  description?: string | null;
  enabled: boolean;
}

let cache: PlacementInfo[] | null = null;
let cacheExpires = 0;

async function ensureDefaults() {
  const count = await prisma.adPlacement.count();
  if (count > 0) return;
  for (const placement of DEFAULT_AD_PLACEMENTS) {
    await prisma.adPlacement
      .upsert({
        where: { key: placement.key },
        update: {},
        create: { key: placement.key, description: placement.description ?? null },
      })
      .catch(() => {
        /* ignore - non-critical */
      });
  }
}

export async function listPlacements(): Promise<PlacementInfo[]> {
  const now = Date.now();
  if (cache && cacheExpires > now) return cache;
  await ensureDefaults();
  const rows = await prisma.adPlacement.findMany({
    orderBy: { key: "asc" },
  });
  cache = rows.map((r) => ({
    key: r.key,
    description: r.description,
    enabled: r.enabled,
  }));
  cacheExpires = now + 30_000;
  return cache;
}

export async function isPlacementAllowed(key: string): Promise<boolean> {
  const placements = await listPlacements();
  const match = placements.find((p) => p.key === key);
  return !!match && match.enabled;
}

export function invalidatePlacementCache() {
  cache = null;
  cacheExpires = 0;
}
