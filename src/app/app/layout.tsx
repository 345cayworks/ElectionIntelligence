import { AdminShell } from "@/components/layout/AdminShell";
import { requireUser } from "@/lib/auth/guards";
import { ensureSuperAdminBootstrap } from "@/lib/auth/superadmin-bootstrap";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await ensureSuperAdminBootstrap();
  const user = await requireUser();
  const currentPath = headers().get("x-current-path") ?? "/app";
  return (
    <AdminShell user={user} currentPath={currentPath}>
      {children}
    </AdminShell>
  );
}
