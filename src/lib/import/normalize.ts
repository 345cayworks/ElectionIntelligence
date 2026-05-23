// Address and column normalization for elector imports.

const STREET_TYPE_ALIASES: Record<string, string> = {
  ave: "Ave",
  avenue: "Ave",
  rd: "Rd",
  road: "Rd",
  st: "St",
  street: "St",
  dr: "Dr",
  drive: "Dr",
  ln: "Ln",
  lane: "Ln",
  way: "Way",
  pl: "Pl",
  place: "Pl",
  cl: "Cl",
  close: "Cl",
  cres: "Cres",
  crescent: "Cres",
  blvd: "Blvd",
  boulevard: "Blvd",
  ct: "Ct",
  court: "Ct",
  pk: "Pk",
  park: "Pk",
  tr: "Tr",
  trail: "Tr",
  ter: "Ter",
  terrace: "Ter",
};

export function normalizeStreetType(input: string | null | undefined): string | null {
  if (!input) return null;
  const key = input.trim().toLowerCase().replace(/\.$/, "");
  if (!key) return null;
  if (STREET_TYPE_ALIASES[key]) return STREET_TYPE_ALIASES[key];
  return input
    .trim()
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, (m) => m.toUpperCase());
}

export function normalizeStreetName(input: string | null | undefined): string | null {
  if (!input) return null;
  return input
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, (m) => m.toUpperCase());
}

export function normalizeName(input: string | null | undefined): string {
  if (!input) return "";
  return input.trim().replace(/\s+/g, " ");
}

export function normalizeSerial(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;
  return s.replace(/\s+/g, "").replace(/^0+/, "") || s;
}

export function normalizeAddressKey(parts: {
  streetNumber?: string | null;
  streetName?: string | null;
  streetType?: string | null;
}): string {
  return [
    (parts.streetNumber ?? "").toString().trim().toLowerCase(),
    (parts.streetName ?? "").toString().trim().toLowerCase(),
    (parts.streetType ?? "").toString().trim().toLowerCase().replace(/\.$/, ""),
  ]
    .map((p) => p.replace(/\s+/g, " "))
    .filter(Boolean)
    .join("|");
}

// Best-effort column lookup. Sheets vary in casing/spacing.
export function pick<T>(row: Record<string, unknown>, candidates: string[]): T | undefined {
  const norm = (s: string) => s.toLowerCase().replace(/[\s_]+/g, "");
  const map = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) {
    map.set(norm(k), v);
  }
  for (const c of candidates) {
    const v = map.get(norm(c));
    if (v !== undefined && v !== null && v !== "") return v as T;
  }
  return undefined;
}
