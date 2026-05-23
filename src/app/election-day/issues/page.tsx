import { requireFieldUser } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layout/SidebarLayout";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/Table";

export const dynamic = "force-dynamic";

export default async function IssuesPage() {
  await requireFieldUser();
  return (
    <div>
      <PageHeader
        title="Issue escalation log"
        description="Polling-station issues, escalated for legal review."
      />
      <Card>
        <CardHeader title="Open issues" />
        <CardBody>
          <EmptyState
            title="No issues logged"
            description="Use this log to record polling-station issues for follow-up with election officials."
          />
        </CardBody>
      </Card>
    </div>
  );
}
