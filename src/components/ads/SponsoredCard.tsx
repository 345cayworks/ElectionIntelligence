"use client";

import { AdSlot } from "./AdSlot";

interface SponsoredCardProps {
  placement: string;
  className?: string;
}

export function SponsoredCard({ placement, className }: SponsoredCardProps) {
  return (
    <AdSlot
      placement={placement}
      className={className}
      variant="sponsored"
      maxHeight={260}
    />
  );
}
