// Scrapes public pages on portal.elections.ky.
//
// The portal sits behind Cloudflare bot protection that frequently blocks
// non-browser User-Agents. We do our best with a realistic UA + standard
// browser headers; if we hit a 403/503, the caller logs the rejection and
// the next scheduled run retries. Failures are non-fatal - the scraper
// never throws to the route handler.
//
// Parsing strategy: cheap regex over the HTML. The portal is a Joomla
// site and is unlikely to redesign meaningfully between elections, but
// when it does, we should fail loud (zero rows parsed) rather than write
// garbage. Each parser below returns null on a clearly-malformed page.

const BASE_URL = "https://portal.elections.ky";

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
};

export interface FetchResult {
  ok: boolean;
  status: number;
  html: string | null;
  reason?: string;
}

export interface ScrapedCandidate {
  name: string;
  constituency: string | null;
  party: string | null;
}

export interface ScrapedPollingStation {
  constituency: string;
  name: string;
  address: string | null;
}

async function fetchPage(pathname: string): Promise<FetchResult> {
  const url = `${BASE_URL}${pathname}`;
  try {
    const response = await fetch(url, {
      headers: BROWSER_HEADERS,
      cache: "no-store",
      redirect: "follow",
    });
    if (!response.ok) {
      return { ok: false, status: response.status, html: null, reason: `http_${response.status}` };
    }
    const html = await response.text();
    if (html.length < 500) {
      return { ok: false, status: response.status, html, reason: "body_too_short" };
    }
    return { ok: true, status: response.status, html };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      html: null,
      reason: `fetch_error: ${(err as Error).message}`,
    };
  }
}

function stripTags(input: string): string {
  return input
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// Parse the 2025 candidates page. Returns null if the structure is so
// different from expectations that we can't extract anything - lets the
// caller decide whether to alert.
export function parseCandidatesPage(html: string): ScrapedCandidate[] | null {
  // Each candidate is published in a card-like block on the Joomla page.
  // We look for the constituency heading + nearby candidate names. The
  // exact structure depends on the portal's template; this is a best-
  // effort extraction that intentionally errs on the side of fewer rows
  // rather than wrong rows.
  const candidates: ScrapedCandidate[] = [];

  // Try a generic pattern: <h3>Constituency Name</h3> followed by a list.
  const sectionRegex =
    /<h[123][^>]*>([^<]{3,80})<\/h[123]>([\s\S]*?)(?=<h[123][^>]*>|$)/gi;
  let match: RegExpExecArray | null;
  while ((match = sectionRegex.exec(html)) !== null) {
    const heading = stripTags(match[1]);
    if (!/(north|south|east|west|central|bay|town|cayman|prospect|newlands|savannah|red|side|brac)/i.test(heading)) {
      continue;
    }
    const body = match[2];
    const nameRegex = /<(?:strong|b|h4|h5|li|td)[^>]*>([A-Z][a-z]+(?:[ '\-][A-Z][a-z]+)+)<\/(?:strong|b|h4|h5|li|td)>/g;
    let nameMatch: RegExpExecArray | null;
    const seen = new Set<string>();
    while ((nameMatch = nameRegex.exec(body)) !== null) {
      const name = stripTags(nameMatch[1]);
      if (name.length < 5 || seen.has(name)) continue;
      seen.add(name);
      candidates.push({
        name,
        constituency: heading,
        party: null,
      });
    }
  }

  if (candidates.length === 0) return null;
  return candidates;
}

export function parsePollingStationsPage(
  html: string,
): ScrapedPollingStation[] | null {
  const stations: ScrapedPollingStation[] = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let row: RegExpExecArray | null;
  while ((row = rowRegex.exec(html)) !== null) {
    const cells = Array.from(row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map(
      (m) => stripTags(m[1]),
    );
    if (cells.length < 2) continue;
    const constituency = cells[0];
    const name = cells[1];
    const address = cells[2] ?? null;
    if (constituency.length < 3 || name.length < 3) continue;
    if (/header|station|constituency/i.test(name)) continue;
    stations.push({ constituency, name, address });
  }
  if (stations.length === 0) return null;
  return stations;
}

export async function fetchCandidatesPage(): Promise<FetchResult> {
  return fetchPage("/index.php/candidates-agents/2025-candidates");
}

export async function fetchPollingStationsPage(): Promise<FetchResult> {
  return fetchPage("/where-how-to-vote/where-to-vote");
}
