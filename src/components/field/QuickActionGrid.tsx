"use client";

import { useState } from "react";
import clsx from "clsx";
import { QUICK_ACTIONS } from "@/lib/constants";

interface ElectorOption {
  id: string;
  name: string;
}

interface QuickActionGridProps {
  householdId: string;
  electors: ElectorOption[];
  defaultElectorId?: string | null;
  issueTags: Array<{ id: string; key: string; label: string }>;
  electionCycleId: string | null;
  canEditPolitical: boolean;
}

export function QuickActionGrid({
  householdId,
  electors,
  defaultElectorId,
  issueTags,
  electionCycleId,
  canEditPolitical,
}: QuickActionGridProps) {
  const [electorId, setElectorId] = useState<string>(defaultElectorId ?? "");
  const [pending, setPending] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [followUp, setFollowUp] = useState(false);
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (action: { kind: string; value: string; label: string }) => {
    if (action.kind === "position" && !canEditPolitical) {
      setError("You do not have permission to record political declarations.");
      return;
    }
    if ((action.kind === "position" || action.kind === "voting_method") && !electorId) {
      setError("Pick an elector before tagging a position or voting method.");
      return;
    }
    setPending(action.label);
    setError(null);
    setMessage(null);

    try {
      if (action.kind === "result") {
        const res = await fetch("/api/visits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            householdId,
            electorId: electorId || null,
            result: action.value,
            notes: notes || undefined,
            followUpRequired: followUp,
            issueTagIds: selectedIssues,
            electionCycleId,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        setMessage(`Logged: ${action.label}`);
        setNotes("");
        setSelectedIssues([]);
        setFollowUp(false);
      } else if (action.kind === "position") {
        const res = await fetch("/api/political-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            electorId,
            declaredPosition: action.value,
            confidenceLevel: "DIRECT_STATEMENT",
            electionCycleId,
            notes: notes || undefined,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        setMessage(`Recorded position: ${action.label}`);
      } else if (action.kind === "voting_method") {
        const res = await fetch("/api/political-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            electorId,
            votingMethodFlag: action.value,
            electionCycleId,
            notes: notes || undefined,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        setMessage(`Recorded voting method: ${action.label}`);
      } else if (action.kind === "followup") {
        setFollowUp(true);
        setMessage("Marked follow-up. Add to your next visit.");
      }
    } catch (e) {
      setError((e as Error).message || "Action failed");
    } finally {
      setPending(null);
    }
  };

  const toneFor = (kind: string) => {
    switch (kind) {
      case "result":
        return "bg-gray-100 hover:bg-gray-200 text-gray-900";
      case "position":
        return "bg-blue-50 hover:bg-blue-100 text-blue-900";
      case "voting_method":
        return "bg-indigo-50 hover:bg-indigo-100 text-indigo-900";
      case "followup":
        return "bg-yellow-50 hover:bg-yellow-100 text-yellow-900";
      default:
        return "bg-gray-100 hover:bg-gray-200 text-gray-900";
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">
          Elector at door
        </label>
        <select
          value={electorId}
          onChange={(e) => setElectorId(e.target.value)}
          className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">— Household level —</option>
          {electors.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {QUICK_ACTIONS.map((a) => {
          const disabled =
            (a.kind === "position" && !canEditPolitical) ||
            pending !== null;
          return (
            <button
              key={a.key}
              onClick={() => submit({ kind: a.kind, value: a.value, label: a.label })}
              disabled={disabled}
              className={clsx(
                "min-h-[3rem] rounded-md border border-transparent px-3 py-3 text-sm font-medium shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                toneFor(a.kind),
              )}
            >
              {pending === a.label ? "..." : a.label}
            </button>
          );
        })}
      </div>

      {issueTags.length > 0 ? (
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Issues raised
          </label>
          <div className="flex flex-wrap gap-1">
            {issueTags.map((tag) => {
              const selected = selectedIssues.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() =>
                    setSelectedIssues((prev) =>
                      selected ? prev.filter((id) => id !== tag.id) : [...prev, tag.id],
                    )
                  }
                  className={clsx(
                    "rounded-full border px-2.5 py-1 text-xs",
                    selected
                      ? "border-purple-500 bg-purple-50 text-purple-900"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
                  )}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Optional notes for this household"
        />
      </div>

      <label className="flex items-center gap-2 text-xs text-gray-700">
        <input
          type="checkbox"
          checked={followUp}
          onChange={(e) => setFollowUp(e.target.checked)}
        />
        Needs follow-up
      </label>

      {message ? (
        <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      ) : null}
    </div>
  );
}
