import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import {
  isSuperAdmin,
  isAdminOrAbove,
  canCanvass,
  canViewReports,
  canImportElectors,
  canManageCampaign,
} from "@/lib/permissions";

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isSuperAdmin(user)) redirect("/login?error=forbidden");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isAdminOrAbove(user)) redirect("/login?error=forbidden");
  return user;
}

export async function requireImporter(): Promise<SessionUser> {
  const user = await requireUser();
  if (!canImportElectors(user)) redirect("/login?error=forbidden");
  return user;
}

export async function requireCampaignManager(): Promise<SessionUser> {
  const user = await requireUser();
  if (!canManageCampaign(user)) redirect("/login?error=forbidden");
  return user;
}

export async function requireFieldUser(): Promise<SessionUser> {
  const user = await requireUser();
  if (!canCanvass(user)) redirect("/login?error=forbidden");
  return user;
}

export async function requireReportViewer(): Promise<SessionUser> {
  const user = await requireUser();
  if (!canViewReports(user)) redirect("/login?error=forbidden");
  return user;
}
