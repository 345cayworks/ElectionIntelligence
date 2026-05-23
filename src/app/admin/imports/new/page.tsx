import { prisma } from "@/lib/db";
import { requireImporter } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layout/SidebarLayout";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Label, Select } from "@/components/ui/Input";
import { IMPORT_SOURCE_TYPES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function NewImportPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  await requireImporter();
  const [cycles, constituencies] = await Promise.all([
    prisma.electionCycle.findMany({ orderBy: { electionDate: "desc" } }),
    prisma.constituency.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="New elector import"
        description="Upload an XLSX or CSV file with the latest elector list."
      />
      {searchParams?.error ? (
        <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {searchParams.error}
        </div>
      ) : null}
      <Card>
        <CardHeader title="Upload file" />
        <CardBody>
          <form
            method="post"
            action="/api/imports/upload"
            encType="multipart/form-data"
            className="space-y-3"
          >
            <Field label={<Label>Election cycle</Label>}>
              <Select name="electionCycleId" defaultValue="">
                <option value="">— None —</option>
                {cycles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={<Label>Constituency</Label>}>
              <Select name="constituencyId" defaultValue="">
                <option value="">— None —</option>
                {constituencies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={<Label>Source type</Label>}>
              <Select name="sourceType" defaultValue="OFFICIAL_REGISTER">
                {IMPORT_SOURCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={<Label>File</Label>}
              hint="Accepts .xlsx, .xls or .csv. Multiple sheets are parsed; the campaign canvassing history is not overwritten."
            >
              <Input
                name="file"
                type="file"
                required
                accept=".xlsx,.xls,.csv"
              />
            </Field>
            <Button type="submit">Upload and parse</Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
