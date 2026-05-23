"use client";

import { AdSlot } from "./AdSlot";

interface AdBannerProps {
  placement: string;
  className?: string;
  maxHeight?: number;
}

export function AdBanner({ placement, className, maxHeight = 180 }: AdBannerProps) {
  return (
    <AdSlot
      placement={placement}
      className={className}
      variant="banner"
      maxHeight={maxHeight}
    />
  );
}
