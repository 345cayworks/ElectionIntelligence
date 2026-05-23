import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireImporter } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layout/SidebarLayout";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Table, THead, TH, TBody, TR, TD, EmptyState } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatDateTime, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ImportsPage() {
  await requireImporter();
  const batches = await prisma.importBatch.findMany({
    orderBy: { importedAt: "desc" },
    include: { constituency: true, electionCycle: true, importedBy: true },
  });

  return (
    <div>
      <PageHeader
        title="Imports"
        description="Upload elector lists and review changes before committing."
        actions={
          <Link href="/admin/imports/new">
            <Button>New import</Button>
          </Link>
        }
      />
      <Card>
        <CardHeader title="All import batches" />
        <CardBody>
          {batches.length === 0 ? (
            <EmptyState
              title="No imports yet"
              description="Upload your first elector spreadsheet to get started."
              action={
                <Link href="/admin/imports/new">
                  <Button>New import</Button>
                </Link>
              }
            />
          ) : (
            <Table>
              <THead>
                <TH>File</TH>
                <TH>Source</TH>
                <TH>Cycle</TH>
                <TH>Constituency</TH>
                <TH>Imported</TH>
                <TH>Rows</TH>
                <TH>New</TH>
                <TH>Removed</TH>
                <TH>Updated</TH>
                <TH>Status</TH>
                <TH />
              </THead>
              <TBody>
                {batches.map((b) => (
                  <TR key={b.id}>
                    <TD>{b.fileName}</TD>
                    <TD>{b.sourceType.replace(/_/g, " ")}</TD>
                    <TD>{b.electionCycle?.name ?? "—"}</TD>
                    <TD>{b.constituency?.name ?? "—"}</TD>
                    <TD>
                      <div>{formatDateTime(b.importedAt)}</div>
                      <div className="text-xs text-gray-500">
                        {b.importedBy?.email ?? "—"}
                      </div>
                    </TD>
                    <TD>{formatNumber(b.rowCount)}</TD>
                    <TD>{formatNumber(b.newCount)}</TD>
                    <TD>{formatNumber(b.removedCount)}</TD>
                    <TD>{formatNumber(b.updatedAddressCount)}</TD>
                    <TD>
                      <StatusBadge status={b.status} />
                    </TD>
                    <TD>
                      <Link
                        className="text-blue-600 hover:underline"
                        href={`/admin/imports/${b.id}`}
                      >
                        View
                      </Link>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
