"use client";

import { useEffect, useRef, useState } from "react";
import { trackAdClick } from "@/lib/tracking";

interface AdCreative {
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

interface AdSlotProps {
  placement: string;
  className?: string;
  renderEmpty?: () => React.ReactNode;
  variant?: "banner" | "sponsored" | "native";
  maxHeight?: number;
}

const DEFAULT_MAX_HEIGHT = 250;

export function AdSlot({
  placement,
  className,
  renderEmpty,
  variant = "banner",
  maxHeight = DEFAULT_MAX_HEIGHT,
}: AdSlotProps) {
  const [ad, setAd] = useState<AdCreative | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [impressionLogged, setImpressionLogged] = useState(false);
  const slotRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/internal/ads/serve?placement=${encodeURIComponent(placement)}`, {
      method: "GET",
    })
      .then((r) => (r.ok ? r.json() : Promise.resolve({ ad: null })))
      .then((data: { ad: AdCreative | null }) => {
        if (cancelled) return;
        setAd(data.ad ?? null);
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [placement]);

  useEffect(() => {
    if (!ad || impressionLogged) return;
    const el = slotRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            fetch("/api/internal/ads/impression", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ creativeId: ad.id, placement: ad.placement }),
            }).catch(() => {
              /* ignore */
            });
            setImpressionLogged(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: [0.5] },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ad, impressionLogged]);

  const handleClick = (e: React.MouseEvent) => {
    if (!ad) return;
    e.preventDefault();
    fetch("/api/internal/ads/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creativeId: ad.id, placement: ad.placement }),
    }).catch(() => {
      /* ignore */
    });
    trackAdClick(ad.placement, { creativeId: ad.id });
    if (typeof window !== "undefined") {
      window.open(ad.destinationUrl, "_blank", "noopener,noreferrer");
    }
  };

  if (!loaded) {
    // Collapse while loading.
    return <div ref={slotRef} aria-hidden className={className} style={{ height: 0 }} />;
  }

  if (!ad) {
    if (renderEmpty) return <>{renderEmpty()}</>;
    return <div ref={slotRef} aria-hidden className={className} style={{ height: 0 }} />;
  }

  const containerStyle: React.CSSProperties = {
    maxHeight: maxHeight,
    overflow: "hidden",
  };

  return (
    <div
      ref={slotRef}
      className={className}
      style={containerStyle}
      data-ad-placement={ad.placement}
      data-ad-id={ad.id}
    >
      <a
        href={ad.destinationUrl}
        onClick={handleClick}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full"
      >
        <AdCreativeBody ad={ad} variant={variant} maxHeight={maxHeight} />
      </a>
      <div className="mt-1 text-[10px] uppercase tracking-wide text-gray-400">
        {ad.sponsor ? `Sponsored - ${ad.sponsor}` : "Sponsored"}
      </div>
    </div>
  );
}

function AdCreativeBody({
  ad,
  variant,
  maxHeight,
}: {
  ad: AdCreative;
  variant: "banner" | "sponsored" | "native";
  maxHeight: number;
}) {
  if (ad.format === "youtube" && ad.youtubeId) {
    return (
      <div
        className="relative w-full"
        style={{ maxHeight, aspectRatio: "16 / 9" }}
      >
        <iframe
          className="h-full w-full rounded"
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(ad.youtubeId)}?modestbranding=1&rel=0`}
          title={ad.headline ?? "Sponsored video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  if (ad.format === "video" && ad.videoUrl) {
    return (
      <video
        controls
        src={ad.videoUrl}
        className="w-full rounded"
        style={{ maxHeight }}
      />
    );
  }

  if (ad.format === "image" && ad.mediaUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={ad.mediaUrl}
        alt={ad.headline ?? "Sponsored"}
        className="w-full rounded object-cover"
        style={{ maxHeight }}
      />
    );
  }

  // Native / sponsored / html fallback
  if (variant === "sponsored" || ad.format === "native") {
    return (
      <div className="flex gap-3 rounded border border-gray-200 bg-white p-3 hover:border-gray-300">
        {ad.mediaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ad.mediaUrl}
            alt=""
            className="h-16 w-16 rounded object-cover"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          {ad.headline ? (
            <div className="truncate text-sm font-medium text-gray-900">
              {ad.headline}
            </div>
          ) : null}
          {ad.body ? (
            <div className="line-clamp-2 text-xs text-gray-600">{ad.body}</div>
          ) : null}
          {ad.ctaLabel ? (
            <div className="mt-1 inline-flex text-xs font-semibold text-blue-700">
              {ad.ctaLabel}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full items-center justify-center rounded border border-dashed border-gray-300 p-4 text-sm text-gray-500">
      {ad.headline ?? "Sponsored"}
    </div>
  );
}
