"use client";

import { AdSlot } from "./AdSlot";

interface NativeAdProps {
  placement: string;
  className?: string;
}

export function NativeAd({ placement, className }: NativeAdProps) {
  return (
    <AdSlot
      placement={placement}
      className={className}
      variant="native"
      maxHeight={220}
    />
  );
}
