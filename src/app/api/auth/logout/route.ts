import { NextRequest, NextResponse } from "next/server";
import { destroySession, getSessionUser } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit/log";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  await destroySession();
  if (user) {
    await recordAudit({
      actorUserId: user.id,
      action: "auth.logout",
    });
  }
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}
