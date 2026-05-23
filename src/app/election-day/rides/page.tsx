import { requireFieldUser } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layout/SidebarLayout";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/Table";

export const dynamic = "force-dynamic";

export default async function RidesPage() {
  await requireFieldUser();
  return (
    <div>
      <PageHeader
        title="Transportation requests"
        description="Requested rides to polling stations. Compliance reviewed."
      />
      <Card>
        <CardHeader title="Open ride requests" />
        <CardBody>
          <EmptyState
            title="No ride requests yet"
            description="When supporters request transportation, requests appear here for dispatch."
          />
        </CardBody>
      </Card>
    </div>
  );
}
