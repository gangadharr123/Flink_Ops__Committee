"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteVisit } from "@/app/(app)/visits/actions";
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
import { formatDate } from "@/lib/format";
import { useOnline } from "@/lib/use-online";
import { clearBackup } from "./use-autosave";

// Delete a visit after a confirmation that names it. Used as "Delete draft"
// (inspectors and admins, drafts) and "Delete visit" (admins, submitted).
// Who may delete is enforced by row-level security, not by this button.
export function DeleteVisitButton({
  visit,
  label,
  className,
}: {
  visit: { id: string; hubName: string; number: number; label: string; visitDate: string; status: string };
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const online = useOnline();
  const submitted = visit.status === "submitted";

  function confirm() {
    setError(null);
    startTransition(async () => {
      // On success the action redirects to /visits.
      const result = await deleteVisit(visit.id);
      if (result?.error) setError(result.error);
      else clearBackup(visit.id);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        onClick={() => setOpen(true)}
        disabled={!online}
        title={online ? undefined : "Needs a connection"}
        className={className}
      >
        <Trash2 /> {label}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {submitted ? "submitted visit" : "draft"}?</AlertDialogTitle>
            <AlertDialogDescription render={<div />}>
              <dl className="my-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-left text-foreground">
                <dt className="text-muted-foreground">Hub</dt>
                <dd className="font-medium">{visit.hubName}</dd>
                <dt className="text-muted-foreground">Visit</dt>
                <dd className="font-medium">
                  Number {visit.number}
                  {visit.label !== `Visit ${visit.number}` && ` (${visit.label})`}
                </dd>
                <dt className="text-muted-foreground">Date</dt>
                <dd className="font-medium">{formatDate(visit.visitDate)}</dd>
              </dl>
              <p className="text-left">
                Its shelf checks, staff feedback, photos and issue updates are deleted. Issues
                recorded only on this visit are deleted; issues later visits also recorded stay,
                with their history updated. This can&apos;t be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={confirm}
              disabled={pending}
              className="h-11"
            >
              {pending ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
