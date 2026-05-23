export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-KY", { year: "numeric", month: "short", day: "2-digit" });
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-KY", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return "0";
  return Number(n).toLocaleString("en-US");
}

export function compactAddress(parts: {
  streetNumber?: string | null;
  streetName?: string | null;
  streetType?: string | null;
}): string {
  return [parts.streetNumber, parts.streetName, parts.streetType]
    .filter(Boolean)
    .map((p) => String(p).trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
