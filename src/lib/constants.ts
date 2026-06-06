// Application-level enums - mirrored as TypeScript types because SQLite
// does not support native Postgres enums. Validated at the boundary by Zod.

export const USER_ROLES = [
  "SUPER_ADMIN",
  "CAMPAIGN_ADMIN",
  "DATA_MANAGER",
  "FIELD_COORDINATOR",
  "CANVASSER",
  "CANDIDATE",
  "OBSERVER_READONLY",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = [
  "ACTIVE",
  "INVITED",
  "SUSPENDED",
  "DISABLED",
] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const ELECTION_STATUSES = [
  "PLANNING",
  "ACTIVE",
  "COMPLETED",
  "ARCHIVED",
] as const;
export type ElectionStatus = (typeof ELECTION_STATUSES)[number];

export const OFFICIAL_STATUSES = [
  "ACTIVE",
  "NEW",
  "REMOVED",
  "MOVED_OUT",
  "MOVED_IN",
  "ADDRESS_UPDATED",
] as const;
export type OfficialStatus = (typeof OFFICIAL_STATUSES)[number];

export const BUILDING_TYPES = ["HOUSE", "APARTMENT", "COMPLEX", "UNKNOWN"] as const;
export type BuildingType = (typeof BUILDING_TYPES)[number];

export const VISIT_METHODS = [
  "DOOR",
  "PHONE",
  "WHATSAPP",
  "EVENT",
  "OFFICE",
] as const;
export type VisitMethod = (typeof VISIT_METHODS)[number];

export const VISIT_RESULTS = [
  "SPOKE",
  "NOT_HOME",
  "REFUSED",
  "MOVED",
  "DECEASED_VERIFY",
  "WRONG_ADDRESS",
] as const;
export type VisitResult = (typeof VISIT_RESULTS)[number];

export const POLITICAL_POSITIONS = [
  "SUPPORTS_US",
  "SUPPORTS_OPPONENT",
  "UNDECIDED",
  "NOT_VOTING",
  "UNKNOWN",
  "REFUSED",
] as const;
export type PoliticalPosition = (typeof POLITICAL_POSITIONS)[number];

export const VOTING_METHOD_FLAGS = ["ORDINARY", "POSTAL", "MOBILE", "UNKNOWN"] as const;
export type VotingMethodFlag = (typeof VOTING_METHOD_FLAGS)[number];

export const CONFIDENCE_LEVELS = [
  "DIRECT_STATEMENT",
  "CANVASSER_OBSERVATION",
  "THIRD_PARTY",
  "UNKNOWN",
] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export const ASSIGNMENT_STATUSES = [
  "UNASSIGNED",
  "ASSIGNED",
  "IN_PROGRESS",
  "COMPLETED",
  "NEEDS_REVISIT",
] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const IMPORT_SOURCE_TYPES = [
  "OFFICIAL_REGISTER",
  "REVISED_LIST",
  "CAMPAIGN_SHEET",
] as const;
export type ImportSourceType = (typeof IMPORT_SOURCE_TYPES)[number];

export const IMPORT_STATUSES = ["PENDING", "REVIEWED", "COMMITTED", "DISCARDED"] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

export const FOLLOWUP_STATUSES = ["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"] as const;
export type FollowUpStatus = (typeof FOLLOWUP_STATUSES)[number];

export const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const DEFAULT_ISSUE_TAGS: Array<{
  key: string;
  label: string;
  description?: string;
}> = [
  { key: "cost_of_living", label: "Cost of living" },
  { key: "pensions", label: "Pensions" },
  { key: "traffic", label: "Traffic" },
  { key: "housing", label: "Housing" },
  { key: "healthcare", label: "Healthcare" },
  { key: "youth", label: "Youth" },
  { key: "jobs", label: "Jobs" },
  { key: "immigration", label: "Immigration" },
  { key: "community_safety", label: "Community safety" },
  { key: "infrastructure", label: "Infrastructure" },
  { key: "education", label: "Education" },
];

export const DEFAULT_AD_PLACEMENTS = [
  { key: "dashboard_top", description: "Top banner on campaign dashboard" },
  { key: "dashboard_sidebar", description: "Sidebar slot on campaign dashboard" },
  { key: "field_top", description: "Top banner on field canvasser dashboard" },
  { key: "elector_profile_sidebar", description: "Sidebar slot on elector profile" },
];

// Registered political parties in the Cayman Islands. Lazy-seeded on
// bootstrap; the operator can edit `color`, `leaderName`, etc. via the
// /admin/parties page without the seed undoing those changes (idempotent
// match by `code`). Independent candidates have no Party row - their
// `partyId` is null.
export const CAYMAN_PARTIES: Array<{
  code: string;
  name: string;
  shortName: string;
  color: string;
  leaderName?: string;
}> = [
  {
    code: "PPM",
    name: "People's Progressive Movement",
    shortName: "PPM",
    color: "#0F4C8A",
  },
  {
    code: "TCCP",
    name: "The Caymanian Community Party",
    shortName: "TCCP",
    color: "#1F8A3A",
  },
  {
    code: "CINP",
    name: "Cayman Islands National Party",
    shortName: "CINP",
    color: "#C2272D",
  },
];

// The 19 official Cayman Islands constituencies (post-2021 boundary
// redistribution). Codes follow the short official abbreviations used
// by the Elections Office (WBN, GTC, RED, etc.). Sister Islands codes
// (CBE / CBW) use the same naming convention; if the official Sister
// Islands codes differ, update this table and the bootstrap migration
// will rename existing rows on the next request.
export const CAYMAN_CONSTITUENCIES: Array<{
  name: string;
  code: string;
  island: string;
}> = [
  // West Bay
  { name: "West Bay North",    code: "WBN", island: "Grand Cayman" },
  { name: "West Bay Central",  code: "WBC", island: "Grand Cayman" },
  { name: "West Bay South",    code: "WBS", island: "Grand Cayman" },
  { name: "West Bay West",     code: "WBW", island: "Grand Cayman" },
  // George Town
  { name: "George Town North",   code: "GTN", island: "Grand Cayman" },
  { name: "George Town Central", code: "GTC", island: "Grand Cayman" },
  { name: "George Town West",    code: "GTW", island: "Grand Cayman" },
  { name: "George Town South",   code: "GTS", island: "Grand Cayman" },
  { name: "George Town East",    code: "GTE", island: "Grand Cayman" },
  // Red Bay
  { name: "Red Bay", code: "RED", island: "Grand Cayman" },
  // Bodden Town district
  { name: "Prospect",          code: "PRO", island: "Grand Cayman" },
  { name: "Newlands",          code: "NEW", island: "Grand Cayman" },
  { name: "Savannah",          code: "SAV", island: "Grand Cayman" },
  { name: "Bodden Town East",  code: "BTE", island: "Grand Cayman" },
  { name: "Bodden Town West",  code: "BTW", island: "Grand Cayman" },
  // Other Districts (Grand Cayman)
  { name: "North Side", code: "NS", island: "Grand Cayman" },
  { name: "East End",   code: "EE", island: "Grand Cayman" },
  // Sister Islands
  { name: "Cayman Brac East",                 code: "CBE", island: "Cayman Brac" },
  { name: "Cayman Brac West & Little Cayman", code: "CBW", island: "Cayman Brac & Little Cayman" },
];

// Quick-action button definitions reused across the field UI.
export const QUICK_ACTIONS: Array<{
  key: string;
  label: string;
  kind: "result" | "position" | "voting_method" | "followup";
  value: string;
}> = [
  { key: "spoke", label: "Spoke", kind: "result", value: "SPOKE" },
  { key: "not_home", label: "Not Home", kind: "result", value: "NOT_HOME" },
  { key: "refused", label: "Refused", kind: "result", value: "REFUSED" },
  { key: "moved", label: "Moved", kind: "result", value: "MOVED" },
  { key: "wrong_address", label: "Wrong Address", kind: "result", value: "WRONG_ADDRESS" },
  { key: "supports_us", label: "Supports Us", kind: "position", value: "SUPPORTS_US" },
  { key: "supports_opponent", label: "Supports Opponent", kind: "position", value: "SUPPORTS_OPPONENT" },
  { key: "undecided", label: "Undecided", kind: "position", value: "UNDECIDED" },
  { key: "not_voting", label: "Not Voting", kind: "position", value: "NOT_VOTING" },
  { key: "postal", label: "Postal Voter", kind: "voting_method", value: "POSTAL" },
  { key: "mobile", label: "Mobile Voter", kind: "voting_method", value: "MOBILE" },
  { key: "follow_up", label: "Needs Follow-up", kind: "followup", value: "true" },
];
