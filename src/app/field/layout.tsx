import { AdminShell } from "@/components/layout/AdminShell";
import { requireFieldUser } from "@/lib/auth/guards";
import { ensureSuperAdminBootstrap } from "@/lib/auth/superadmin-bootstrap";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function FieldLayout({ children }: { children: React.ReactNode }) {
  await ensureSuperAdminBootstrap();
  const user = await requireFieldUser();
  const currentPath = headers().get("x-current-path") ?? "/field";
  return (
    <AdminShell user={user} currentPath={currentPath}>
      {children}
    </AdminShell>
  );
}
