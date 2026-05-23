import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireReportViewer } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layout/SidebarLayout";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/Card";
import { Table, THead, TH, TBody, TR, TD } from "@/components/ui/Table";

export const dynamic = "force-dynamic";

export default async function DataQualityReportPage() {
  await requireReportViewer();

  const [missingSerial, unmatchedHouseholds, removed, recentImports] = await Promise.all([
    prisma.elector.count({ where: { officialSerialNo: null } }),
    prisma.elector.count({ where: { currentHouseholdId: null } }),
    prisma.elector.count({ where: { officialStatus: "REMOVED" } }),
    prisma.importBatch.findMany({
      orderBy: { importedAt: "desc" },
      take: 5,
      include: { constituency: true },
    }),
  ]);

  return (
    <div>
      <PageHeader title="Data quality" />
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Electors missing serial" value={missingSerial} accent="yellow" />
        <StatCard label="Electors with no household" value={unmatchedHouseholds} accent="yellow" />
        <StatCard label="Marked removed" value={removed} accent="red" />
      </div>

      <Card>
        <CardHeader title="Recent imports" />
        <CardBody>
          <Table>
            <THead>
              <TH>File</TH>
              <TH>Constituency</TH>
              <TH>Rows</TH>
              <TH>New</TH>
              <TH>Removed</TH>
              <TH>Duplicates</TH>
              <TH />
            </THead>
            <TBody>
              {recentImports.map((b) => (
                <TR key={b.id}>
                  <TD>{b.fileName}</TD>
                  <TD>{b.constituency?.name ?? "—"}</TD>
                  <TD>{b.rowCount}</TD>
                  <TD>{b.newCount}</TD>
                  <TD>{b.removedCount}</TD>
                  <TD>{b.duplicateCount}</TD>
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
        </CardBody>
      </Card>
    </div>
  );
}
