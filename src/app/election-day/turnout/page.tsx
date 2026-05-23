import { requireFieldUser } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layout/SidebarLayout";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/Table";

export const dynamic = "force-dynamic";

export default async function TurnoutPage() {
  await requireFieldUser();
  return (
    <div>
      <PageHeader
        title="Turnout tracker"
        description="Voted / not-yet-voted lists, refreshed during election day."
      />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Polling stations" value={0} />
        <StatCard label="Reported voted" value={0} accent="green" />
        <StatCard label="Outstanding" value={0} accent="yellow" />
        <StatCard label="Issues" value={0} accent="red" />
      </div>
      <Card>
        <CardHeader title="Today's turnout" />
        <CardBody>
          <EmptyState
            title="Activate the turnout module on election day"
            description="A polling-station feed will populate this table once the day-of integration is enabled."
          />
        </CardBody>
      </Card>
    </div>
  );
}
