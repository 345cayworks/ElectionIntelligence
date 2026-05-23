import { NextRequest, NextResponse } from "next/server";
import { serveAd } from "@/lib/ads/server-client";
import { isPlacementAllowed } from "@/lib/ads/placements";
import { publicEnv } from "@/lib/env";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!publicEnv.adsEnabled) {
    return NextResponse.json({ ad: null }, { status: 200 });
  }

  const placement = req.nextUrl.searchParams.get("placement") ?? "";
  if (!placement) {
    return NextResponse.json({ ad: null, reason: "missing_placement" }, { status: 200 });
  }

  if (!(await isPlacementAllowed(placement))) {
    return NextResponse.json({ ad: null, reason: "placement_not_allowed" }, { status: 200 });
  }

  const user = await getSessionUser();
  const ad = await serveAd({ placement, userRole: user?.role });
  return NextResponse.json({ ad });
}
