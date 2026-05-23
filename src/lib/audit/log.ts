import { prisma } from "@/lib/db";

export type AuditSeverity = "INFO" | "WARN" | "SENSITIVE" | "CRITICAL";

export interface AuditEntry {
  actorUserId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  severity?: AuditSeverity;
  ipAddress?: string | null;
  userAgent?: string | null;
}

// Records the audit entry. Best-effort - never throws back to the caller.
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: entry.actorUserId ?? null,
        action: entry.action,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        severity: entry.severity ?? "INFO",
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  } catch (err) {
    // Audit logging failures must not break primary actions, but should
    // surface in server logs for investigation.
    // eslint-disable-next-line no-console
    console.error("[audit] failed to record entry", { action: entry.action, err });
  }
}
