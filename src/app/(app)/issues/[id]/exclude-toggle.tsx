"use client";

import { useOptimistic, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { setIssueExcluded } from "../actions";

// On/off switch for exclude_from_outputs. Saves immediately; useOptimistic
// shows the new position right away and snaps back if saving fails.
export function ExcludeToggle({
  issueId,
  initial,
  disabled,
}: {
  issueId: string;
  initial: boolean;
  disabled: boolean;
}) {
  const [saved, setSaved] = useState(initial);
  const [shown, setShown] = useOptimistic(saved);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggle() {
    const next = !shown;
    setError(null);
    startTransition(async () => {
      setShown(next);
      const result = await setIssueExcluded(issueId, next);
      if (result.error) setError(result.error);
      else setSaved(next);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={shown}
        onClick={toggle}
        disabled={disabled}
        className="flex min-h-12 w-full items-center justify-between gap-4 rounded-xl border p-3 text-left disabled:opacity-60"
      >
        <span>
          <span className="block font-medium">Hide from reports</span>
          <span className="block text-sm text-muted-foreground">
            Skipped in the Word report and Airtable text.
          </span>
        </span>
        <span
          aria-hidden
          className={cn(
            "flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors",
            shown ? "bg-primary" : "bg-muted-foreground/30",
          )}
        >
          <span
            className={cn(
              "size-6 rounded-full bg-background shadow transition-transform",
              shown && "translate-x-5",
            )}
          />
        </span>
      </button>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
