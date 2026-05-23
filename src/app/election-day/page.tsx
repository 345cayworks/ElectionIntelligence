import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireFieldUser } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layout/SidebarLayout";
import { Card, CardHeader, StatCard } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

export default async function ElectionDayPage() {
  await requireFieldUser();
  const [supporters, postalMobile, openFollowUps] = await Promise.all([
    prisma.electorPoliticalStatus.count({
      where: { declaredPosition: "SUPPORTS_US", isCurrent: true },
    }),
    prisma.electorPoliticalStatus.count({
      where: { votingMethodFlag: { in: ["POSTAL", "MOBILE"] }, isCurrent: true },
    }),
    prisma.followUpTask.count({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Election day command center"
        description="Operational module - subject to legal review before live use."
      />
      <div className="mb-4 rounded border border-yellow-200 bg-yellow-50 px-4 py-3 text-xs text-yellow-800">
        <strong>Compliance reminder:</strong> Use of this module must comply with
        Cayman Islands election rules. This platform is operational tooling - it
        does not automate voter contact, transport allocation, or anything that
        could be construed as voter suppression.
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Declared supporters" value={supporters} accent="green" />
        <StatCard label="Postal/Mobile voters" value={postalMobile} accent="blue" />
        <StatCard label="Open follow-ups" value={openFollowUps} accent="yellow" />
        <StatCard label="Reports" value="Live" accent="gray" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <NavCard href="/election-day/turnout" title="Turnout" description="Voted / not-yet-voted tracker" />
        <NavCard href="/election-day/rides" title="Rides" description="Transportation requests" />
        <NavCard href="/election-day/issues" title="Issues" description="Escalation log" />
        <NavCard href="/election-day/volunteers" title="Volunteers" description="Day-of assignments" />
      </div>
    </div>
  );
}

function NavCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardHeader title={<Link className="text-blue-700 hover:underline" href={href}>{title}</Link>} description={description} />
    </Card>
  );
}
