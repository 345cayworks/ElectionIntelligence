import { SidebarLayout, type NavGroup } from "@/components/layout/SidebarLayout";
import type { SessionUser } from "@/lib/auth/session";
import { isSuperAdmin, isAdminOrAbove, canImportElectors, canViewAuditLogs } from "@/lib/permissions";

export function AdminShell({
  user,
  currentPath,
  children,
}: {
  user: SessionUser;
  currentPath?: string;
  children: React.ReactNode;
}) {
  const groups: NavGroup[] = [
    {
      title: "Campaign",
      items: [
        { href: "/app/dashboard", label: "Dashboard" },
        { href: "/app/electors", label: "Electors" },
        { href: "/app/households", label: "Households" },
        { href: "/app/reports", label: "Reports" },
        { href: "/app/assignments", label: "Assignments" },
        { href: "/app/streets", label: "Streets" },
      ],
    },
    {
      title: "Field",
      items: [
        { href: "/field", label: "Field App" },
        { href: "/field/streets", label: "My Streets" },
        { href: "/field/follow-ups", label: "Follow-ups" },
      ],
    },
  ];

  if (isAdminOrAbove(user)) {
    groups.push({
      title: "Administration",
      items: [
        { href: "/admin/elections", label: "Elections" },
        { href: "/admin/constituencies", label: "Constituencies" },
        { href: "/admin/polling-stations", label: "Polling Stations" },
        { href: "/admin/parties", label: "Parties" },
        { href: "/admin/candidates", label: "Candidates" },
        ...(canImportElectors(user)
          ? [{ href: "/admin/imports", label: "Imports" }]
          : []),
        { href: "/admin/compliance", label: "Compliance" },
        { href: "/admin/data-retention", label: "Data Retention" },
        ...(canViewAuditLogs(user)
          ? [{ href: "/admin/audit-logs", label: "Audit Logs" }]
          : []),
      ],
    });
  }

  if (isSuperAdmin(user)) {
    groups.push({
      title: "SuperAdmin",
      items: [
        { href: "/admin/settings", label: "Settings" },
        { href: "/admin/ads-test", label: "Ads Tester" },
      ],
    });
  }

  groups.push({
    title: "Election Day",
    items: [
      { href: "/election-day", label: "Command Center" },
      { href: "/election-day/turnout", label: "Turnout" },
      { href: "/election-day/rides", label: "Rides" },
      { href: "/election-day/issues", label: "Issues" },
      { href: "/election-day/volunteers", label: "Volunteers" },
    ],
  });

  return (
    <SidebarLayout
      user={user}
      title="Election Intelligence"
      groups={groups}
      currentPath={currentPath}
    >
      {children}
    </SidebarLayout>
  );
}
