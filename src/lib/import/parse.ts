import * as XLSX from "xlsx";
import { pick, normalizeName, normalizeSerial, normalizeStreetName, normalizeStreetType, normalizeAddressKey } from "./normalize";

export interface ParsedElectorRow {
  source: "CANVASSING_LIST" | "UPDATE_LIST" | "FULL_LIST" | "UNKNOWN";
  rawIndex: number;
  serial: string | null;
  fullName: string;
  occupation: string | null;
  streetNumber: string | null;
  streetName: string | null;
  streetType: string | null;
  combinedAddress: string | null;
  normalizedAddress: string;
  pollingDivision: string | null;
  voterIntent: string | null;
  remarks: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
}

export interface ParsedWorkbook {
  rows: ParsedElectorRow[];
  sheets: Array<{
    name: string;
    rows: number;
    matchedAs: ParsedElectorRow["source"];
  }>;
  warnings: string[];
}

function classifySheet(name: string): ParsedElectorRow["source"] {
  const n = name.toLowerCase();
  if (n.includes("canvass")) return "CANVASSING_LIST";
  if (n.includes("update")) return "UPDATE_LIST";
  if (n.includes("full")) return "FULL_LIST";
  return "UNKNOWN";
}

function asString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function parseRows(
  sheet: XLSX.WorkSheet,
  source: ParsedElectorRow["source"],
): ParsedElectorRow[] {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    raw: false,
    defval: "",
  });
  const result: ParsedElectorRow[] = [];

  rows.forEach((row, index) => {
    const fullName = normalizeName(
      asString(
        pick<string>(row, ["full name", "name", "elector name"]),
      ) ?? "",
    );
    if (!fullName) return; // skip blanks

    const streetNumber = asString(
      pick<string>(row, [
        "street num",
        "street number",
        "street no",
        "house number",
        "house no",
        "no",
        "#",
      ]),
    );
    const streetName = normalizeStreetName(
      asString(pick<string>(row, ["street name", "street", "road name", "address line"])),
    );
    const streetType = normalizeStreetType(
      asString(pick<string>(row, ["street type", "type"])),
    );

    const combined = asString(
      pick<string>(row, ["combined street address", "address", "full address", "street"]),
    );

    const normalizedAddress = normalizeAddressKey({
      streetNumber,
      streetName,
      streetType,
    });

    const serial = normalizeSerial(
      asString(pick<string>(row, ["serial no", "serial", "officialserialno", "s/n"])),
    );

    const remarks = asString(pick<string>(row, ["remarks", "remark", "status"]));
    const voterIntent = asString(
      pick<string>(row, ["voter intent", "intent", "voter status", "decision"]),
    );

    const phone = asString(pick<string>(row, ["phone", "mobile", "tel", "telephone"]));
    const email = asString(pick<string>(row, ["email"]));

    const occupation = asString(pick<string>(row, ["occupation", "job"]));
    const pld = asString(pick<string>(row, ["pld", "polling division", "poll div"]));
    const notes = asString(pick<string>(row, ["notes", "note", "comments"]));

    result.push({
      source,
      rawIndex: index,
      serial,
      fullName,
      occupation,
      streetNumber,
      streetName,
      streetType,
      combinedAddress: combined,
      normalizedAddress: normalizedAddress || `name:${fullName.toLowerCase()}|i:${index}`,
      pollingDivision: pld,
      voterIntent,
      remarks,
      phone,
      email,
      notes,
    });
  });

  return result;
}

export function parseWorkbook(buffer: Buffer): ParsedWorkbook {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheets: ParsedWorkbook["sheets"] = [];
  const allRows: ParsedElectorRow[] = [];
  const warnings: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const matched = classifySheet(sheetName);
    const rows = parseRows(workbook.Sheets[sheetName], matched);
    sheets.push({ name: sheetName, rows: rows.length, matchedAs: matched });
    if (matched === "UNKNOWN") {
      warnings.push(
        `Sheet "${sheetName}" was not recognized as canvassing/update/full. Treated as elector data.`,
      );
    }
    allRows.push(...rows);
  }

  // Prefer the "full list" sheet as the authoritative version of each elector,
  // falling back to update list, then canvassing list, then unknown.
  const priority: Record<ParsedElectorRow["source"], number> = {
    FULL_LIST: 3,
    UPDATE_LIST: 2,
    CANVASSING_LIST: 1,
    UNKNOWN: 0,
  };
  const byKey = new Map<string, ParsedElectorRow>();
  for (const row of allRows) {
    const key =
      (row.serial ? `serial:${row.serial}` : null) ??
      `name:${row.fullName.toLowerCase()}|addr:${row.normalizedAddress}`;
    const existing = byKey.get(key);
    if (!existing || priority[row.source] > priority[existing.source]) {
      byKey.set(key, row);
    }
  }
  return { rows: Array.from(byKey.values()), sheets, warnings };
}
