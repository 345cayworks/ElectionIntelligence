import clsx from "clsx";

type Tone = "green" | "yellow" | "red" | "gray" | "blue" | "purple";

const toneClasses: Record<Tone, string> = {
  green: "bg-green-100 text-green-800 ring-green-200",
  yellow: "bg-yellow-100 text-yellow-800 ring-yellow-200",
  red: "bg-red-100 text-red-800 ring-red-200",
  gray: "bg-gray-100 text-gray-800 ring-gray-200",
  blue: "bg-blue-100 text-blue-800 ring-blue-200",
  purple: "bg-purple-100 text-purple-800 ring-purple-200",
};

export function Badge({
  tone = "gray",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { tone: Tone; label?: string }> = {
    // Election cycle
    PLANNING: { tone: "gray" },
    ACTIVE: { tone: "green" },
    COMPLETED: { tone: "blue" },
    ARCHIVED: { tone: "gray" },
    // Official status
    NEW: { tone: "green" },
    REMOVED: { tone: "red" },
    MOVED_OUT: { tone: "red" },
    MOVED_IN: { tone: "green" },
    ADDRESS_UPDATED: { tone: "yellow" },
    // Visit result
    SPOKE: { tone: "green" },
    NOT_HOME: { tone: "yellow" },
    REFUSED: { tone: "red" },
    MOVED: { tone: "red" },
    DECEASED_VERIFY: { tone: "gray" },
    WRONG_ADDRESS: { tone: "red" },
    // Political position
    SUPPORTS_US: { tone: "green" },
    SUPPORTS_OPPONENT: { tone: "red" },
    UNDECIDED: { tone: "yellow" },
    NOT_VOTING: { tone: "gray" },
    UNKNOWN: { tone: "gray" },
    // Voting method
    ORDINARY: { tone: "gray" },
    POSTAL: { tone: "blue" },
    MOBILE: { tone: "blue" },
    // Assignment
    UNASSIGNED: { tone: "gray" },
    ASSIGNED: { tone: "blue" },
    IN_PROGRESS: { tone: "yellow" },
    NEEDS_REVISIT: { tone: "yellow" },
    // Generic
    OPEN: { tone: "yellow" },
    DONE: { tone: "green" },
    CANCELLED: { tone: "gray" },
    PENDING: { tone: "gray" },
    REVIEWED: { tone: "blue" },
    COMMITTED: { tone: "green" },
    DISCARDED: { tone: "red" },
  };
  const entry = map[status] ?? { tone: "gray" as Tone };
  return <Badge tone={entry.tone}>{entry.label ?? status}</Badge>;
}
