import { requireAdmin } from "@/lib/auth/guards";
import {
  adsServerConfigStatus,
  diagnoseEngine,
  serveAd,
} from "@/lib/ads/server-client";
import { listPlacements } from "@/lib/ads/placements";
import { PageHeader } from "@/components/layout/SidebarLayout";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AdBanner } from "@/components/ads/AdBanner";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams?: { placement?: string };
}

export default async function AdsTestPage({ searchParams }: PageProps) {
  const user = await requireAdmin();
  // Admin or SuperAdmin can view. Settings management lives on /admin/settings.

  const status = adsServerConfigStatus();
  const placements = await listPlacements();
  const selected = searchParams?.placement ?? placements[0]?.key ?? "";

  // Run server-side checks for the selected placement.
  const [diagnosis, serveResult] = await Promise.all([
    diagnoseEngine(),
    selected ? serveAd({ placement: selected, userRole: user.role }) : Promise.resolve(null),
  ]);

  return (
    <div>
      <PageHeader
        title="Cayworks Ads tester"
        description="Verify Ads Engine connectivity, server config, and live ad rendering."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Server environment" />
          <CardBody>
            <StatusRow
              label="AD_ENGINE_KEY"
              ok={status.keyConfigured}
              okLabel="configured"
              warnLabel="missing"
            />
            <StatusRow
              label="AD_ENGINE_BASE_URL"
              ok={!!status.baseUrl}
              okLabel={status.baseUrl}
              warnLabel="missing"
            />
            <StatusRow
              label="AD_ENGINE_PLATFORM"
              ok={!!status.platform}
              okLabel={status.platform}
              warnLabel="missing"
            />
            <StatusRow
              label="NEXT_PUBLIC_ENABLE_ADS"
              ok={env.ads.publicEnabled}
              okLabel="true"
              warnLabel="false"
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Endpoint checks" />
          <CardBody>
            <StatusRow
              label="Diagnose endpoint"
              ok={diagnosis.ok}
              okLabel={`200 OK (${diagnosis.status ?? "?"})`}
              warnLabel={
                diagnosis.reason === "missing_key"
                  ? "missing key"
                  : `WARN (${diagnosis.status ?? diagnosis.reason ?? "no response"})`
              }
              fallbackToWarn
            />
            <StatusRow
              label={`Serve test (${selected || "no placement"})`}
              ok={serveResult !== null}
              okLabel={`creative ${serveResult?.id ?? ""}`}
              warnLabel="no creative returned"
              fallbackToWarn
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Live AdBanner preview" />
          <CardBody>
            {selected ? (
              <>
                <form className="mb-3 flex items-center gap-2 text-xs" method="get">
                  <label htmlFor="placement">Placement</label>
                  <select
                    id="placement"
                    name="placement"
                    defaultValue={selected}
                    className="rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                  >
                    {placements.map((p) => (
                      <option key={p.key} value={p.key} disabled={!p.enabled}>
                        {p.key}
                        {p.enabled ? "" : " (disabled)"}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="rounded border border-gray-300 bg-white px-2 py-1 hover:bg-gray-50"
                  >
                    Reload
                  </button>
                </form>
                <div className="rounded border border-dashed border-gray-300 p-3">
                  <AdBanner placement={selected} maxHeight={220} />
                </div>
              </>
            ) : (
              <div className="text-xs text-gray-500">
                No placements registered yet.
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Safety reminders" />
          <CardBody className="space-y-2 text-xs text-gray-600">
            <p>
              The Ad Engine key is read on the server only and never sent to the
              browser, including from this page. Click and impression events
              go through internal proxy routes at
              <code className="mx-1 rounded bg-gray-100 px-1">/api/internal/ads/*</code>.
            </p>
            <p>
              A 404 on the diagnose endpoint is treated as a WARN rather than
              FAIL; the engine may not implement diagnose. Live serve test
              determines whether real ads are returned.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function StatusRow({
  label,
  ok,
  okLabel,
  warnLabel,
  fallbackToWarn,
}: {
  label: string;
  ok: boolean;
  okLabel: string;
  warnLabel: string;
  fallbackToWarn?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 py-2 text-xs last:border-b-0">
      <span className="text-gray-700">{label}</span>
      <Badge tone={ok ? "green" : fallbackToWarn ? "yellow" : "red"}>
        {ok ? okLabel : warnLabel}
      </Badge>
    </div>
  );
}
