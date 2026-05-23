import Link from "next/link";
import { requireReportViewer } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layout/SidebarLayout";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

const REPORTS: Array<{
  href: string;
  title: string;
  description: string;
  sensitive?: boolean;
}> = [
  {
    href: "/app/reports/unvisited",
    title: "Unvisited households",
    description: "Households with no recorded visit yet.",
  },
  {
    href: "/app/reports/not-home",
    title: "Not home revisit list",
    description: "Households where the last visit returned NOT_HOME.",
  },
  {
    href: "/app/reports/undecided",
    title: "Undecided follow-up list",
    description: "Electors flagged as Undecided in their most recent declaration.",
    sensitive: true,
  },
  {
    href: "/app/reports/postal-mobile",
    title: "Postal/Mobile voter list",
    description: "Electors flagged as postal or mobile voters.",
    sensitive: true,
  },
  {
    href: "/app/reports/street-completion",
    title: "Street completion report",
    description: "Per-street visit progress.",
  },
  {
    href: "/app/reports/data-quality",
    title: "Data quality report",
    description: "Missing serials, unmatched households, suspect duplicates.",
  },
];

export default async function ReportsIndexPage() {
  await requireReportViewer();
  return (
    <div>
      <PageHeader
        title="Reports"
        description="Operational reports computed live from current data."
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <Card key={r.href}>
            <CardHeader
              title={
                <Link className="text-blue-700 hover:underline" href={r.href}>
                  {r.title}
                </Link>
              }
              description={r.description}
            />
            {r.sensitive ? (
              <CardBody className="text-xs text-yellow-700">
                Permission-gated. Sensitive political data.
              </CardBody>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
