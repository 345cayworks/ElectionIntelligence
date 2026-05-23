// SERVER-ONLY module. Never import from a "use client" file.
// Reads AD_ENGINE_KEY exactly once. Never returns it. Never logs it.

import "server-only";

const BASE_URL = (
  process.env.AD_ENGINE_BASE_URL ?? "https://ads.cayworks.com"
).replace(/\/$/, "");

const PLATFORM = process.env.AD_ENGINE_PLATFORM ?? "election-intelligence";

function getKey(): string | null {
  const k = process.env.AD_ENGINE_KEY;
  if (!k || k.length === 0) return null;
  return k;
}

export interface AdCreative {
  id: string;
  placement: string;
  format: "image" | "video" | "native" | "youtube" | "html";
  destinationUrl: string;
  mediaUrl?: string;
  videoUrl?: string;
  youtubeId?: string;
  headline?: string;
  body?: string;
  ctaLabel?: string;
  sponsor?: string;
  width?: number;
  height?: number;
}

export interface ServeAdParams {
  placement: string;
  userRole?: string;
  variants?: number;
}

const KEY_HEADER = "X-Ad-Engine-Key";

async function callEngine<T>(
  path: string,
  init: RequestInit & { searchParams?: Record<string, string> },
): Promise<T | null> {
  const key = getKey();
  if (!key) return null;

  const url = new URL(`${BASE_URL}${path}`);
  if (init.searchParams) {
    for (const [k, v] of Object.entries(init.searchParams)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    }
  }

  try {
    const response = await fetch(url.toString(), {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        [KEY_HEADER]: key,
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    });
    if (!response.ok) {
      if (response.status === 404) return null;
      // eslint-disable-next-line no-console
      console.warn(`[ads] engine returned ${response.status} for ${path}`);
      return null;
    }
    return (await response.json()) as T;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[ads] engine call failed", { path, message: (err as Error).message });
    return null;
  }
}

export async function serveAd(
  params: ServeAdParams,
): Promise<AdCreative | null> {
  if (!getKey()) return null;

  const searchParams: Record<string, string> = {
    platform: PLATFORM,
    placement: params.placement,
  };
  if (params.userRole) searchParams.userRole = params.userRole;
  if (params.variants !== undefined) searchParams.variants = String(params.variants);

  return callEngine<AdCreative>("/api/ads/serve", {
    method: "GET",
    searchParams,
  });
}

export async function recordImpression(payload: {
  creativeId: string;
  placement: string;
  userRole?: string;
}): Promise<boolean> {
  if (!getKey()) return false;
  const res = await callEngine<{ ok: boolean }>("/api/ads/impression", {
    method: "POST",
    body: JSON.stringify({ ...payload, platform: PLATFORM }),
  });
  return !!res?.ok;
}

export async function recordClick(payload: {
  creativeId: string;
  placement: string;
  userRole?: string;
}): Promise<boolean> {
  if (!getKey()) return false;
  const res = await callEngine<{ ok: boolean }>("/api/ads/click", {
    method: "POST",
    body: JSON.stringify({ ...payload, platform: PLATFORM }),
  });
  return !!res?.ok;
}

export async function diagnoseEngine(): Promise<{
  ok: boolean;
  status?: number;
  reason?: string;
}> {
  if (!getKey()) return { ok: false, reason: "missing_key" };
  try {
    const response = await fetch(`${BASE_URL}/api/ads/diagnose`, {
      headers: { [KEY_HEADER]: getKey() ?? "" },
      cache: "no-store",
    });
    return { ok: response.ok, status: response.status };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

export function adsServerConfigStatus() {
  return {
    keyConfigured: getKey() !== null,
    baseUrl: BASE_URL,
    platform: PLATFORM,
  };
}
