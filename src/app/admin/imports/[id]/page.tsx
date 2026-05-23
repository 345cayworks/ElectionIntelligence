import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireImporter } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layout/SidebarLayout";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { formatDateTime, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ImportDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireImporter();
  const batch = await prisma.importBatch.findUnique({
    where: { id: params.id },
    include: {
      importedBy: true,
      constituency: true,
      electionCycle: true,
    },
  });
  if (!batch) notFound();

  const warnings: string[] = batch.warnings ? JSON.parse(batch.warnings) : [];

  return (
    <div>
      <PageHeader
        title={`Import: ${batch.fileName}`}
        description={`Source: ${batch.sourceType.replace(/_/g, " ")} - Uploaded ${formatDateTime(
          batch.importedAt,
        )} by ${batch.importedBy?.email ?? "—"}`}
        actions={
          batch.status === "PENDING" ? (
            <Link href={`/admin/imports/${batch.id}/review`}>
              <Button>Review changes</Button>
            </Link>
          ) : (
            <StatusBadge status={batch.status} />
          )
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Rows" value={formatNumber(batch.rowCount)} />
        <StatCard label="New" value={formatNumber(batch.newCount)} accent="green" />
        <StatCard
          label="Moved in"
          value={formatNumber(batch.movedInCount)}
          accent="green"
        />
        <StatCard
          label="Removed"
          value={formatNumber(batch.removedCount)}
          accent="red"
        />
        <StatCard
          label="Address updated"
          value={formatNumber(batch.updatedAddressCount)}
          accent="yellow"
        />
        <StatCard
          label="Duplicates"
          value={formatNumber(batch.duplicateCount)}
          accent="yellow"
        />
        <StatCard
          label="Cycle"
          value={batch.electionCycle?.name ?? "—"}
        />
        <StatCard
          label="Constituency"
          value={batch.constituency?.name ?? "—"}
        />
      </div>

      <Card>
        <CardHeader title="Warnings" />
        <CardBody>
          {warnings.length === 0 ? (
            <div className="text-sm text-gray-500">None.</div>
          ) : (
            <ul className="space-y-1 text-xs">
              {warnings.map((w, i) => (
                <li key={i}>
                  <Badge tone="yellow">!</Badge> {w}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
