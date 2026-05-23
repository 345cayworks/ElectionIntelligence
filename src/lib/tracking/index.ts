// Client-safe tracking helpers. Never throw, never block the page.
// Loads only when NEXT_PUBLIC_ENABLE_TRACKING=true AND a relevant ID is set.

import { publicEnv } from "@/lib/env";

type AnyRecord = Record<string, unknown>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

function isEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return publicEnv.tracking.enabled;
}

function hasGoogle(): boolean {
  return (
    isEnabled() &&
    (publicEnv.tracking.gaMeasurementId.length > 0 ||
      publicEnv.tracking.googleTagId.length > 0)
  );
}

function hasMeta(): boolean {
  return isEnabled() && publicEnv.tracking.metaPixelId.length > 0;
}

export function trackPageView(path?: string): void {
  try {
    if (hasGoogle() && typeof window.gtag === "function") {
      window.gtag("event", "page_view", {
        page_path: path ?? window.location.pathname,
      });
    }
    if (hasMeta() && typeof window.fbq === "function") {
      window.fbq("track", "PageView");
    }
  } catch {
    // tracking failures must not break the app
  }
}

export function trackEvent(name: string, params?: AnyRecord): void {
  try {
    if (hasGoogle() && typeof window.gtag === "function") {
      window.gtag("event", name, params ?? {});
    }
    if (hasMeta() && typeof window.fbq === "function") {
      window.fbq("trackCustom", name, params ?? {});
    }
  } catch {
    /* ignore */
  }
}

export function trackSignup(method?: string): void {
  trackEvent("sign_up", { method: method ?? "email" });
  if (hasMeta() && typeof window !== "undefined" && typeof window.fbq === "function") {
    try {
      window.fbq("track", "CompleteRegistration");
    } catch {
      /* ignore */
    }
  }
}

export function trackLead(params?: AnyRecord): void {
  trackEvent("generate_lead", params);
  if (hasMeta() && typeof window !== "undefined" && typeof window.fbq === "function") {
    try {
      window.fbq("track", "Lead", params);
    } catch {
      /* ignore */
    }
  }
}

export function trackPurchase(value: number, currency = "KYD", params?: AnyRecord): void {
  trackEvent("purchase", { value, currency, ...(params ?? {}) });
  if (hasMeta() && typeof window !== "undefined" && typeof window.fbq === "function") {
    try {
      window.fbq("track", "Purchase", { value, currency, ...(params ?? {}) });
    } catch {
      /* ignore */
    }
  }
}

export function trackAdClick(placement: string, params?: AnyRecord): void {
  trackEvent("ad_click", { placement, ...(params ?? {}) });
}
