import { AdminShell } from "@/components/layout/AdminShell";
import { requireAdmin } from "@/lib/auth/guards";
import { ensureSuperAdminBootstrap } from "@/lib/auth/superadmin-bootstrap";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await ensureSuperAdminBootstrap();
  const user = await requireAdmin();
  const currentPath = headers().get("x-current-path") ?? "/admin";
  return (
    <AdminShell user={user} currentPath={currentPath}>
      {children}
    </AdminShell>
  );
}
