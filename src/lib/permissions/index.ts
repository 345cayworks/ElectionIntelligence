import type { UserRole } from "@/lib/constants";

interface ActorLike {
  role: string;
  status?: string;
  id?: string;
}

const isActive = (u: ActorLike | null | undefined) =>
  !!u && (u.status ?? "ACTIVE") === "ACTIVE";

const has = (u: ActorLike | null | undefined, roles: UserRole[]) =>
  !!u && isActive(u) && roles.includes(u.role as UserRole);

export function isSuperAdmin(u: ActorLike | null | undefined): boolean {
  return has(u, ["SUPER_ADMIN"]);
}

export function isAdminOrAbove(u: ActorLike | null | undefined): boolean {
  return has(u, ["SUPER_ADMIN", "CAMPAIGN_ADMIN"]);
}

export function canManageCampaign(u: ActorLike | null | undefined): boolean {
  return has(u, ["SUPER_ADMIN", "CAMPAIGN_ADMIN"]);
}

export function canImportElectors(u: ActorLike | null | undefined): boolean {
  return has(u, ["SUPER_ADMIN", "CAMPAIGN_ADMIN", "DATA_MANAGER"]);
}

export function canViewSensitivePoliticalData(
  u: ActorLike | null | undefined,
): boolean {
  return has(u, [
    "SUPER_ADMIN",
    "CAMPAIGN_ADMIN",
    "DATA_MANAGER",
    "FIELD_COORDINATOR",
    "CANDIDATE",
  ]);
}

export function canEditSensitivePoliticalData(
  u: ActorLike | null | undefined,
): boolean {
  return has(u, [
    "SUPER_ADMIN",
    "CAMPAIGN_ADMIN",
    "DATA_MANAGER",
    "FIELD_COORDINATOR",
    "CANVASSER",
  ]);
}

export function canAssignCanvassers(u: ActorLike | null | undefined): boolean {
  return has(u, ["SUPER_ADMIN", "CAMPAIGN_ADMIN", "FIELD_COORDINATOR"]);
}

export function canViewReports(u: ActorLike | null | undefined): boolean {
  return has(u, [
    "SUPER_ADMIN",
    "CAMPAIGN_ADMIN",
    "DATA_MANAGER",
    "FIELD_COORDINATOR",
    "CANDIDATE",
    "OBSERVER_READONLY",
  ]);
}

export function canExportSensitive(u: ActorLike | null | undefined): boolean {
  return has(u, ["SUPER_ADMIN", "CAMPAIGN_ADMIN", "DATA_MANAGER"]);
}

export function canViewAuditLogs(u: ActorLike | null | undefined): boolean {
  return has(u, ["SUPER_ADMIN", "CAMPAIGN_ADMIN"]);
}

export function canCanvass(u: ActorLike | null | undefined): boolean {
  return has(u, [
    "SUPER_ADMIN",
    "CAMPAIGN_ADMIN",
    "FIELD_COORDINATOR",
    "CANVASSER",
  ]);
}
