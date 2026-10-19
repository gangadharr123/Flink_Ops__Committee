"use client";

import { useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { EditorShelf } from "@/lib/visits";
import { useVisitCounts } from "./step-summary";

// Confirms submitting. Warns about unchecked shelves but still allows it.
export function SubmitDialog({
  open,
  onOpenChange,
  shelves,
  label,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shelves: EditorShelf[];
  label: string;
  onConfirm: () => Promise<string | null>;
}) {
  const counts = useVisitCounts(shelves);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const problem = await onConfirm();
      if (problem) setError(problem);
      else onOpenChange(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Submit {label}?</AlertDialogTitle>
          <AlertDialogDescription>
            After submitting, this visit is read-only.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {(counts.unchecked > 0 || counts.staffWithoutRole > 0) && (
          <ul className="list-disc rounded-lg bg-amber-500/10 py-2 pr-3 pl-7 text-sm text-amber-800 dark:text-amber-300">
            {counts.unchecked > 0 && (
              <li>
                {counts.unchecked} of {shelves.length} shelves are not checked.
              </li>
            )}
            {counts.staffWithoutRole > 0 && (
              <li>
                {counts.staffWithoutRole} staff card(s) have no role and will
                not be saved.
              </li>
            )}
          </ul>
        )}
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11">Cancel</AlertDialogCancel>
          <Button type="button" onClick={confirm} disabled={pending} className="h-11">
            {pending ? "Submitting..." : "Submit visit"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
