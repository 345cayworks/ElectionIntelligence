import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCampaignManager } from "@/lib/auth/guards";
import { isSuperAdmin } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit/log";
import { PageHeader } from "@/components/layout/SidebarLayout";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Field, Select, Textarea } from "@/components/ui/Input";
import { Table, THead, TH, TBody, TR, TD, EmptyState } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import {
  importPollingStations,
  type ImportPollingStation,
} from "@/lib/elections-import";
import stationsRaw from "../../../../data/polling-stations.json";

interface StationsFile {
  stations: ImportPollingStation[];
}
const stationsData = stationsRaw as unknown as StationsFile;

export const dynamic = "force-dynamic";

const StationSchema = z.object({
  constituencyId: z.string().min(1),
  name: z.string().min(2).max(160),
  code: z.string().max(40).optional(),
  address: z.string().max(300).optional(),
  city: z.string().max(80).optional(),
  notes: z.string().max(500).optional(),
});

export default async function PollingStationsPage({
  searchParams,
}: {
  searchParams?: { notice?: string; error?: string };
}) {
  const actor = await requireCampaignManager();
  const showImportButton = isSuperAdmin(actor);

  const [stations, constituencies] = await Promise.all([
    prisma.pollingStation.findMany({
      orderBy: [{ constituency: { name: "asc" } }, { name: "asc" }],
      include: { constituency: true },
    }),
    prisma.constituency.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Polling stations"
        description="Polling stations published by the Elections Office per cycle (portal.elections.ky/where-how-to-vote). Address fields are freeform — match the official publication exactly."
      />
      {searchParams?.notice ? (
        <div className="mb-3 rounded border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
          {searchParams.notice}
        </div>
      ) : null}
      {searchParams?.error ? (
        <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {searchParams.error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title={`Polling stations (${stations.length})`} />
            <CardBody>
              {stations.length === 0 ? (
                <EmptyState
                  title="No polling stations yet"
                  description="Add by hand below or wait for the scheduled scraper to ingest from portal.elections.ky."
                />
              ) : (
                <Table>
                  <THead>
                    <TH>Constituency</TH>
                    <TH>Name</TH>
                    <TH>Code</TH>
                    <TH>Address</TH>
                    <TH>Status</TH>
                  </THead>
                  <TBody>
                    {stations.map((s) => (
                      <TR key={s.id}>
                        <TD>{s.constituency.name}</TD>
                        <TD>{s.name}</TD>
                        <TD>
                          {s.code ? (
                            <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
                              {s.code}
                            </code>
                          ) : (
                            "—"
                          )}
                        </TD>
                        <TD className="text-xs text-gray-600">
                          {[s.address, s.city].filter(Boolean).join(", ") || "—"}
                        </TD>
                        <TD>
                          {s.active ? (
                            <Badge tone="green">Active</Badge>
                          ) : (
                            <Badge tone="gray">Inactive</Badge>
                          )}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardBody>
          </Card>
        </div>
        <div className="space-y-6">
          {showImportButton ? (
            <Card>
              <CardHeader title="Import polling stations" />
              <CardBody>
                <p className="text-xs text-gray-600">
                  Bulk-import from{" "}
                  <code className="rounded bg-gray-100 px-1 py-0.5">
                    data/polling-stations.json
                  </code>
                  . Idempotent - upserts by (constituencyCode + name).
                  Currently <strong>{stationsData.stations.length}</strong>{" "}
                  entries in the JSON.
                </p>
                <p className="mt-2 text-xs text-gray-500">
                  Source: portal.elections.ky/where-how-to-vote. Update the
                  JSON file from the current cycle&apos;s official notice before
                  re-running.
                </p>
                <form action={runImportStations} className="mt-3">
                  <Button type="submit" variant="outline">
                    Import polling stations
                  </Button>
                </form>
              </CardBody>
            </Card>
          ) : null}
        <Card>
          <CardHeader title="New polling station" />
          <CardBody>
            {constituencies.length === 0 ? (
              <div className="text-xs text-gray-500">
                Create at least one constituency first.
              </div>
            ) : (
              <form action={createStation} className="space-y-3">
                <Field label={<Label>Constituency</Label>}>
                  <Select name="constituencyId" required>
                    {constituencies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={<Label>Name</Label>}>
                  <Input name="name" required placeholder="John Gray High School" />
                </Field>
                <Field
                  label={<Label>Official code</Label>}
                  hint="Optional. e.g. WBN-01"
                >
                  <Input name="code" maxLength={40} />
                </Field>
                <Field label={<Label>Address</Label>}>
                  <Input name="address" placeholder="Walkers Road" />
                </Field>
                <Field label={<Label>City / district</Label>}>
                  <Input name="city" placeholder="George Town" />
                </Field>
                <Field label={<Label>Notes</Label>}>
                  <Textarea name="notes" rows={2} />
                </Field>
                <Button type="submit">Create</Button>
              </form>
            )}
          </CardBody>
        </Card>
        </div>
      </div>
    </div>
  );
}

async function runImportStations(): Promise<void> {
  "use server";
  const actor = await requireCampaignManager();
  if (!isSuperAdmin(actor)) {
    redirect(
      `/admin/polling-stations?error=${encodeURIComponent("SuperAdmin only.")}`,
    );
  }
  try {
    const summary = await importPollingStations(stationsData.stations);
    await recordAudit({
      actorUserId: actor.id,
      action: "polling_station.import",
      metadata: { ...summary, source: "button" },
      severity: "WARN",
    });
    revalidatePath("/admin/polling-stations");
    const parts = [
      `${summary.inserted} created`,
      `${summary.updated} updated`,
    ];
    if (summary.skipped > 0) {
      parts.push(
        `${summary.skipped} skipped (unknown constituency codes: ${summary.skippedCodes.join(", ")})`,
      );
    }
    redirect(
      `/admin/polling-stations?notice=${encodeURIComponent("Imported polling stations: " + parts.join(", "))}`,
    );
  } catch (err) {
    if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
    const msg = err instanceof Error ? err.message : "Import failed";
    redirect(
      `/admin/polling-stations?error=${encodeURIComponent(`Import failed: ${msg}`)}`,
    );
  }
}

async function createStation(formData: FormData) {
  "use server";
  const actor = await requireCampaignManager();
  const parsed = StationSchema.safeParse({
    constituencyId: formData.get("constituencyId"),
    name: formData.get("name"),
    code: formData.get("code") || undefined,
    address: formData.get("address") || undefined,
    city: formData.get("city") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    const msg = encodeURIComponent(
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    );
    redirect(`/admin/polling-stations?error=${msg}`);
  }
  try {
    const created = await prisma.pollingStation.create({
      data: {
        constituencyId: parsed.data.constituencyId,
        name: parsed.data.name,
        code: parsed.data.code ?? null,
        address: parsed.data.address ?? null,
        city: parsed.data.city ?? null,
        notes: parsed.data.notes ?? null,
      },
    });
    await recordAudit({
      actorUserId: actor.id,
      action: "polling_station.create",
      entityType: "PollingStation",
      entityId: created.id,
      metadata: { name: created.name, constituencyId: created.constituencyId },
    });
  } catch {
    redirect(
      `/admin/polling-stations?error=${encodeURIComponent("Code must be unique")}`,
    );
  }
  revalidatePath("/admin/polling-stations");
  redirect("/admin/polling-stations?notice=Polling+station+created");
}
