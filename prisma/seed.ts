import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_ISSUE_TAGS, DEFAULT_AD_PLACEMENTS } from "../src/lib/constants";

const prisma = new PrismaClient();

async function main() {
  // SuperAdmin (only if SUPER_ADMIN_EMAIL is set and no SuperAdmin exists)
  const email = process.env.SUPER_ADMIN_EMAIL?.toLowerCase();
  if (email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) {
      const password = process.env.SUPER_ADMIN_SEED_PASSWORD ?? "ChangeMe123!";
      const passwordHash = await bcrypt.hash(password, 12);
      await prisma.user.create({
        data: {
          email,
          name: "SuperAdmin",
          role: "SUPER_ADMIN",
          status: "ACTIVE",
          passwordHash,
          forcePasswordReset: true,
        },
      });
      console.log(`Seeded SuperAdmin ${email} with temporary password ${password}`);
    }
  }

  // Demo cycle and constituency (Red Bay)
  const cycle = await prisma.electionCycle.upsert({
    where: { id: "demo-cycle" },
    update: {},
    create: {
      id: "demo-cycle",
      name: "2025 General Election (Demo)",
      electionDate: new Date("2025-04-30"),
      status: "PLANNING",
      notes: "Seed data for development.",
    },
  });

  const redBay = await prisma.constituency.upsert({
    where: { code: "red-bay" },
    update: {},
    create: { name: "Red Bay", code: "red-bay", island: "Grand Cayman" },
  });

  // Candidate codes referenced in the original workbook.
  const candidates = [
    { code: "DT", name: "Candidate DT", primary: true },
    { code: "PPM", name: "PPM Slate", primary: false },
    { code: "NMW", name: "NMW Candidate", primary: false },
    { code: "PE", name: "PE Candidate", primary: false },
    { code: "LG", name: "LG Candidate", primary: false },
  ];
  for (const c of candidates) {
    await prisma.candidate.upsert({
      where: {
        electionCycleId_constituencyId_shorthandCode: {
          electionCycleId: cycle.id,
          constituencyId: redBay.id,
          shorthandCode: c.code,
        },
      },
      update: {},
      create: {
        electionCycleId: cycle.id,
        constituencyId: redBay.id,
        name: c.name,
        shorthandCode: c.code,
        isPrimaryCampaignCandidate: c.primary,
      },
    });
  }

  // Issue tags
  for (let i = 0; i < DEFAULT_ISSUE_TAGS.length; i++) {
    const tag = DEFAULT_ISSUE_TAGS[i];
    await prisma.issueTag.upsert({
      where: { key: tag.key },
      update: { label: tag.label, sortOrder: i },
      create: { key: tag.key, label: tag.label, sortOrder: i },
    });
  }

  // Ad placements
  for (const p of DEFAULT_AD_PLACEMENTS) {
    await prisma.adPlacement.upsert({
      where: { key: p.key },
      update: {},
      create: { key: p.key, description: p.description ?? null },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
