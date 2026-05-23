import { NextRequest, NextResponse } from "next/server";
import { recordImpression } from "@/lib/ads/server-client";
import { isPlacementAllowed } from "@/lib/ads/placements";
import { publicEnv } from "@/lib/env";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!publicEnv.adsEnabled) return NextResponse.json({ ok: false }, { status: 200 });

  let payload: { creativeId?: string; placement?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  if (!payload.creativeId || !payload.placement) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!(await isPlacementAllowed(payload.placement))) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const user = await getSessionUser();
  const ok = await recordImpression({
    creativeId: payload.creativeId,
    placement: payload.placement,
    userRole: user?.role,
  });
  return NextResponse.json({ ok });
}
