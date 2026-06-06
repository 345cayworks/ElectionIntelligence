-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'OBSERVER_READONLY',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "forcePasswordReset" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdPlacement" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdPlacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectionCycle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "electionDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElectionCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Constituency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "island" TEXT NOT NULL DEFAULT 'Grand Cayman',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Constituency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "shortName" TEXT,
    "color" TEXT,
    "leaderName" TEXT,
    "foundedAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "electionCycleId" TEXT NOT NULL,
    "constituencyId" TEXT NOT NULL,
    "partyId" TEXT,
    "name" TEXT NOT NULL,
    "partyName" TEXT,
    "shorthandCode" TEXT NOT NULL,
    "isPrimaryCampaignCandidate" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollingStation" (
    "id" TEXT NOT NULL,
    "constituencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "address" TEXT,
    "city" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PollingStation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectionResult" (
    "id" TEXT NOT NULL,
    "electionCycleId" TEXT NOT NULL,
    "constituencyId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "votesReceived" INTEGER NOT NULL,
    "votesPercent" DOUBLE PRECISION,
    "rank" INTEGER,
    "isWinner" BOOLEAN NOT NULL DEFAULT false,
    "totalValidVotes" INTEGER,
    "totalRegistered" INTEGER,
    "turnoutPercent" DOUBLE PRECISION,
    "source" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElectionResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "electionCycleId" TEXT,
    "constituencyId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "importedByUserId" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceType" TEXT NOT NULL DEFAULT 'OFFICIAL_REGISTER',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "committedAt" TIMESTAMP(3),
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "newCount" INTEGER NOT NULL DEFAULT 0,
    "movedInCount" INTEGER NOT NULL DEFAULT 0,
    "movedOutCount" INTEGER NOT NULL DEFAULT 0,
    "removedCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAddressCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "warnings" TEXT,
    "rawSummary" TEXT,
    "diffPreview" TEXT,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Household" (
    "id" TEXT NOT NULL,
    "constituencyId" TEXT,
    "streetNumber" TEXT,
    "streetName" TEXT,
    "streetType" TEXT,
    "normalizedAddress" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "buildingType" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Household_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Elector" (
    "id" TEXT NOT NULL,
    "officialSerialNo" TEXT,
    "constituencyId" TEXT,
    "pollingDivision" TEXT,
    "fullName" TEXT NOT NULL,
    "occupation" TEXT,
    "currentHouseholdId" TEXT,
    "officialStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "sourceImportBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Elector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectorContact" (
    "id" TEXT NOT NULL,
    "electorId" TEXT NOT NULL,
    "contactType" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "consentNotes" TEXT,
    "source" TEXT,
    "capturedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElectorContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanvassVisit" (
    "id" TEXT NOT NULL,
    "electionCycleId" TEXT,
    "constituencyId" TEXT,
    "householdId" TEXT,
    "electorId" TEXT,
    "canvasserId" TEXT,
    "visitDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visitMethod" TEXT NOT NULL DEFAULT 'DOOR',
    "result" TEXT NOT NULL DEFAULT 'SPOKE',
    "notes" TEXT,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "followUpDate" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanvassVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectorPoliticalStatus" (
    "id" TEXT NOT NULL,
    "electorId" TEXT NOT NULL,
    "electionCycleId" TEXT,
    "declaredPosition" TEXT NOT NULL,
    "declaredCandidateId" TEXT,
    "votingMethodFlag" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "confidenceLevel" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "notes" TEXT,
    "capturedByUserId" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ElectorPoliticalStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueTag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "IssueTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectorIssue" (
    "id" TEXT NOT NULL,
    "electorId" TEXT NOT NULL,
    "issueTagId" TEXT NOT NULL,
    "notes" TEXT,
    "capturedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElectorIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUpTask" (
    "id" TEXT NOT NULL,
    "electionCycleId" TEXT,
    "electorId" TEXT,
    "householdId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "assignedToUserId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "FollowUpTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanvassAssignment" (
    "id" TEXT NOT NULL,
    "electionCycleId" TEXT,
    "constituencyId" TEXT,
    "householdId" TEXT,
    "streetName" TEXT,
    "streetType" TEXT,
    "assignedToUserId" TEXT,
    "assignedByUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNASSIGNED',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanvassAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_token_idx" ON "Session"("token");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_severity_idx" ON "AuditLog"("severity");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformSetting_key_key" ON "PlatformSetting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "AdPlacement_key_key" ON "AdPlacement"("key");

-- CreateIndex
CREATE INDEX "ElectionCycle_status_idx" ON "ElectionCycle"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Constituency_code_key" ON "Constituency"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Party_code_key" ON "Party"("code");

-- CreateIndex
CREATE INDEX "Candidate_constituencyId_idx" ON "Candidate"("constituencyId");

-- CreateIndex
CREATE INDEX "Candidate_electionCycleId_idx" ON "Candidate"("electionCycleId");

-- CreateIndex
CREATE INDEX "Candidate_partyId_idx" ON "Candidate"("partyId");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_electionCycleId_constituencyId_shorthandCode_key" ON "Candidate"("electionCycleId", "constituencyId", "shorthandCode");

-- CreateIndex
CREATE UNIQUE INDEX "PollingStation_code_key" ON "PollingStation"("code");

-- CreateIndex
CREATE INDEX "PollingStation_constituencyId_idx" ON "PollingStation"("constituencyId");

-- CreateIndex
CREATE INDEX "ElectionResult_electionCycleId_constituencyId_idx" ON "ElectionResult"("electionCycleId", "constituencyId");

-- CreateIndex
CREATE INDEX "ElectionResult_isWinner_idx" ON "ElectionResult"("isWinner");

-- CreateIndex
CREATE UNIQUE INDEX "ElectionResult_electionCycleId_candidateId_key" ON "ElectionResult"("electionCycleId", "candidateId");

-- CreateIndex
CREATE INDEX "ImportBatch_electionCycleId_idx" ON "ImportBatch"("electionCycleId");

-- CreateIndex
CREATE INDEX "ImportBatch_constituencyId_idx" ON "ImportBatch"("constituencyId");

-- CreateIndex
CREATE INDEX "ImportBatch_importedAt_idx" ON "ImportBatch"("importedAt");

-- CreateIndex
CREATE INDEX "ImportBatch_status_idx" ON "ImportBatch"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Household_normalizedAddress_key" ON "Household"("normalizedAddress");

-- CreateIndex
CREATE INDEX "Household_streetName_idx" ON "Household"("streetName");

-- CreateIndex
CREATE INDEX "Household_constituencyId_idx" ON "Household"("constituencyId");

-- CreateIndex
CREATE INDEX "Elector_fullName_idx" ON "Elector"("fullName");

-- CreateIndex
CREATE INDEX "Elector_officialSerialNo_idx" ON "Elector"("officialSerialNo");

-- CreateIndex
CREATE INDEX "Elector_currentHouseholdId_idx" ON "Elector"("currentHouseholdId");

-- CreateIndex
CREATE INDEX "Elector_constituencyId_idx" ON "Elector"("constituencyId");

-- CreateIndex
CREATE INDEX "Elector_officialStatus_idx" ON "Elector"("officialStatus");

-- CreateIndex
CREATE INDEX "ElectorContact_electorId_idx" ON "ElectorContact"("electorId");

-- CreateIndex
CREATE INDEX "ElectorContact_contactType_idx" ON "ElectorContact"("contactType");

-- CreateIndex
CREATE INDEX "CanvassVisit_householdId_idx" ON "CanvassVisit"("householdId");

-- CreateIndex
CREATE INDEX "CanvassVisit_electorId_idx" ON "CanvassVisit"("electorId");

-- CreateIndex
CREATE INDEX "CanvassVisit_canvasserId_idx" ON "CanvassVisit"("canvasserId");

-- CreateIndex
CREATE INDEX "CanvassVisit_visitDate_idx" ON "CanvassVisit"("visitDate");

-- CreateIndex
CREATE INDEX "CanvassVisit_result_idx" ON "CanvassVisit"("result");

-- CreateIndex
CREATE INDEX "CanvassVisit_archivedAt_idx" ON "CanvassVisit"("archivedAt");

-- CreateIndex
CREATE INDEX "ElectorPoliticalStatus_electorId_idx" ON "ElectorPoliticalStatus"("electorId");

-- CreateIndex
CREATE INDEX "ElectorPoliticalStatus_electionCycleId_idx" ON "ElectorPoliticalStatus"("electionCycleId");

-- CreateIndex
CREATE INDEX "ElectorPoliticalStatus_declaredPosition_idx" ON "ElectorPoliticalStatus"("declaredPosition");

-- CreateIndex
CREATE INDEX "ElectorPoliticalStatus_votingMethodFlag_idx" ON "ElectorPoliticalStatus"("votingMethodFlag");

-- CreateIndex
CREATE UNIQUE INDEX "IssueTag_key_key" ON "IssueTag"("key");

-- CreateIndex
CREATE INDEX "ElectorIssue_issueTagId_idx" ON "ElectorIssue"("issueTagId");

-- CreateIndex
CREATE UNIQUE INDEX "ElectorIssue_electorId_issueTagId_key" ON "ElectorIssue"("electorId", "issueTagId");

-- CreateIndex
CREATE INDEX "FollowUpTask_assignedToUserId_idx" ON "FollowUpTask"("assignedToUserId");

-- CreateIndex
CREATE INDEX "FollowUpTask_dueDate_idx" ON "FollowUpTask"("dueDate");

-- CreateIndex
CREATE INDEX "FollowUpTask_status_idx" ON "FollowUpTask"("status");

-- CreateIndex
CREATE INDEX "CanvassAssignment_assignedToUserId_idx" ON "CanvassAssignment"("assignedToUserId");

-- CreateIndex
CREATE INDEX "CanvassAssignment_householdId_idx" ON "CanvassAssignment"("householdId");

-- CreateIndex
CREATE INDEX "CanvassAssignment_status_idx" ON "CanvassAssignment"("status");

-- CreateIndex
CREATE INDEX "CanvassAssignment_streetName_idx" ON "CanvassAssignment"("streetName");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_electionCycleId_fkey" FOREIGN KEY ("electionCycleId") REFERENCES "ElectionCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_constituencyId_fkey" FOREIGN KEY ("constituencyId") REFERENCES "Constituency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollingStation" ADD CONSTRAINT "PollingStation_constituencyId_fkey" FOREIGN KEY ("constituencyId") REFERENCES "Constituency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionResult" ADD CONSTRAINT "ElectionResult_electionCycleId_fkey" FOREIGN KEY ("electionCycleId") REFERENCES "ElectionCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionResult" ADD CONSTRAINT "ElectionResult_constituencyId_fkey" FOREIGN KEY ("constituencyId") REFERENCES "Constituency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionResult" ADD CONSTRAINT "ElectionResult_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_electionCycleId_fkey" FOREIGN KEY ("electionCycleId") REFERENCES "ElectionCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_constituencyId_fkey" FOREIGN KEY ("constituencyId") REFERENCES "Constituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_importedByUserId_fkey" FOREIGN KEY ("importedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Household" ADD CONSTRAINT "Household_constituencyId_fkey" FOREIGN KEY ("constituencyId") REFERENCES "Constituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Elector" ADD CONSTRAINT "Elector_constituencyId_fkey" FOREIGN KEY ("constituencyId") REFERENCES "Constituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Elector" ADD CONSTRAINT "Elector_currentHouseholdId_fkey" FOREIGN KEY ("currentHouseholdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Elector" ADD CONSTRAINT "Elector_sourceImportBatchId_fkey" FOREIGN KEY ("sourceImportBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectorContact" ADD CONSTRAINT "ElectorContact_electorId_fkey" FOREIGN KEY ("electorId") REFERENCES "Elector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanvassVisit" ADD CONSTRAINT "CanvassVisit_electionCycleId_fkey" FOREIGN KEY ("electionCycleId") REFERENCES "ElectionCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanvassVisit" ADD CONSTRAINT "CanvassVisit_constituencyId_fkey" FOREIGN KEY ("constituencyId") REFERENCES "Constituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanvassVisit" ADD CONSTRAINT "CanvassVisit_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanvassVisit" ADD CONSTRAINT "CanvassVisit_electorId_fkey" FOREIGN KEY ("electorId") REFERENCES "Elector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanvassVisit" ADD CONSTRAINT "CanvassVisit_canvasserId_fkey" FOREIGN KEY ("canvasserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectorPoliticalStatus" ADD CONSTRAINT "ElectorPoliticalStatus_electorId_fkey" FOREIGN KEY ("electorId") REFERENCES "Elector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectorPoliticalStatus" ADD CONSTRAINT "ElectorPoliticalStatus_electionCycleId_fkey" FOREIGN KEY ("electionCycleId") REFERENCES "ElectionCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectorPoliticalStatus" ADD CONSTRAINT "ElectorPoliticalStatus_declaredCandidateId_fkey" FOREIGN KEY ("declaredCandidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectorPoliticalStatus" ADD CONSTRAINT "ElectorPoliticalStatus_capturedByUserId_fkey" FOREIGN KEY ("capturedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectorIssue" ADD CONSTRAINT "ElectorIssue_electorId_fkey" FOREIGN KEY ("electorId") REFERENCES "Elector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectorIssue" ADD CONSTRAINT "ElectorIssue_issueTagId_fkey" FOREIGN KEY ("issueTagId") REFERENCES "IssueTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpTask" ADD CONSTRAINT "FollowUpTask_electionCycleId_fkey" FOREIGN KEY ("electionCycleId") REFERENCES "ElectionCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpTask" ADD CONSTRAINT "FollowUpTask_electorId_fkey" FOREIGN KEY ("electorId") REFERENCES "Elector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpTask" ADD CONSTRAINT "FollowUpTask_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpTask" ADD CONSTRAINT "FollowUpTask_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpTask" ADD CONSTRAINT "FollowUpTask_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanvassAssignment" ADD CONSTRAINT "CanvassAssignment_electionCycleId_fkey" FOREIGN KEY ("electionCycleId") REFERENCES "ElectionCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanvassAssignment" ADD CONSTRAINT "CanvassAssignment_constituencyId_fkey" FOREIGN KEY ("constituencyId") REFERENCES "Constituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanvassAssignment" ADD CONSTRAINT "CanvassAssignment_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanvassAssignment" ADD CONSTRAINT "CanvassAssignment_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanvassAssignment" ADD CONSTRAINT "CanvassAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

