"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackPageView } from "@/lib/tracking";

// Pings tracking on every client-side navigation.
export function PageViewTracker() {
  const pathname = usePathname();
  const params = useSearchParams();

  useEffect(() => {
    const query = params?.toString();
    const path = query ? `${pathname}?${query}` : pathname;
    trackPageView(path);
  }, [pathname, params]);

  return null;
}
