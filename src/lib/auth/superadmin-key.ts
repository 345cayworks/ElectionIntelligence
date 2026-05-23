import crypto from "crypto";

// Server-only access to SUPERADMIN_MASTER_KEY.
// Never re-exported. Never logged. Never returned.
// Read once per process to discourage casual misuse.

let cachedKeyHash: string | null = null;

function readMasterKey(): string | null {
  const raw = process.env.SUPERADMIN_MASTER_KEY;
  if (!raw || raw.length < 16) return null;
  return raw;
}

function hashFor(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function isMasterKeyConfigured(): boolean {
  return readMasterKey() !== null;
}

// Returns a SHA256 hash of the configured master key so we can compare
// without keeping the plaintext around.
export function getMasterKeyHash(): string | null {
  if (cachedKeyHash) return cachedKeyHash;
  const key = readMasterKey();
  if (!key) return null;
  cachedKeyHash = hashFor(key);
  return cachedKeyHash;
}

export function verifyMasterKey(candidate: string): boolean {
  const stored = getMasterKeyHash();
  if (!stored) return false;
  const provided = hashFor(candidate);
  // Timing-safe comparison on equal-length hex strings.
  return crypto.timingSafeEqual(Buffer.from(stored), Buffer.from(provided));
}
