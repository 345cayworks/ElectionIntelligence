import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Inject the current pathname as a header so layouts can read it without
// reaching for unstable APIs.
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  res.headers.set("x-current-path", req.nextUrl.pathname);
  return res;
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|api/internal).*)"],
};
