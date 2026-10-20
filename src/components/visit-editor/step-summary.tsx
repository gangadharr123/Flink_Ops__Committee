"use client";

import { useState, useTransition } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  isShelfChanged,
  issueFormKey,
  shelfKey,
  type ManagerPresent,
  type VisitFormValues,
} from "@/lib/visit-form";
import type { EditorIssue, EditorShelf } from "@/lib/visits";
import { ChoiceChips } from "./choice-chips";
import { clearBackup } from "./use-autosave";

const MANAGER_OPTIONS: { value: ManagerPresent; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unknown", label: "Not recorded" },
];

// Step 4: manager present, overall impression, notes, a quick overview,
// and deleting the draft. Submitting is in the bottom bar.
export function StepSummary({
  shelves,
  openIssues,
  newIssueCount,
  visitId,
  readOnly,
  canDelete,
}: {
  shelves: EditorShelf[];
  openIssues: EditorIssue[];
  newIssueCount: number;
  visitId: string;
  readOnly: boolean;
  canDelete: boolean;
}) {
  const { control, register } = useFormContext<VisitFormValues>();
  const counts = useVisitCounts(shelves, openIssues);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Manager present</span>
        <Controller
          control={control}
          name="manager_present"
          render={({ field }) => (
            <ChoiceChips
              label="Manager present"
              options={MANAGER_OPTIONS}
              value={field.value}
              onChange={(v) => field.onChange(v ?? "unknown")}
              disabled={readOnly}
              className="grid-cols-3"
            />
          )}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="stock_and_space">Stock and space</Label>
        <Textarea
          id="stock_and_space"
          rows={3}
          readOnly={readOnly}
          placeholder="Overstock, access to stock, back room, space use... One point per line."
          {...register("stock_and_space")}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="overall_impression">Overall impression</Label>
        <Textarea
          id="overall_impression"
          rows={4}
          readOnly={readOnly}
          placeholder="How did the hub look and feel overall? One point per line."
          {...register("overall_impression")}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          rows={3}
          readOnly={readOnly}
          placeholder="Anything else: who you couldn't talk to, racks, stickers..."
          {...register("notes")}
        />
      </div>

      <dl className="grid grid-cols-2 gap-3 rounded-xl border p-4 text-sm sm:grid-cols-3">
        <Stat label="Shelves checked" value={`${counts.checked} / ${shelves.length}`} />
        <Stat label="Mould" value={counts.mould} alert={counts.mould > 0} />
        <Stat label="Changed" value={counts.changed} />
        <Stat
          label="Open issues updated"
          value={`${openIssues.length - counts.issuesNotUpdated} / ${openIssues.length}`}
        />
        <Stat label="New issues" value={newIssueCount} />
        <Stat label="Staff spoken to" value={counts.staff} />
      </dl>

      {canDelete && <DeleteDraft visitId={visitId} />}
    </section>
  );
}

function Stat({
  label,
  value,
  alert,
}: {
  label: string;
  value: string | number;
  alert?: boolean;
}) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={alert ? "text-lg font-semibold text-destructive" : "text-lg font-semibold"}>
        {value}
      </dd>
    </div>
  );
}

// Live counts used by the summary and the submit dialog.
export function useVisitCounts(shelves: EditorShelf[], openIssues: EditorIssue[]) {
  const { control } = useFormContext<VisitFormValues>();
  const values = useWatch({ control, name: "shelves" });
  const staff = useWatch({ control, name: "staff" });
  const issues = useWatch({ control, name: "issues" });

  let checked = 0;
  let mould = 0;
  let changed = 0;
  for (const shelf of shelves) {
    const value = values[shelfKey(shelf.number)];
    if (!value) continue;
    if (value.condition) checked++;
    if (value.condition === "mould") mould++;
    if (isShelfChanged(value, shelf.previous)) changed++;
  }
  return {
    checked,
    unchecked: shelves.length - checked,
    mould,
    changed,
    staff: staff.length,
    staffWithoutRole: staff.filter((s) => s.staff_role === null).length,
    issuesNotUpdated: openIssues.filter((i) => !issues[issueFormKey(i.id)]?.state).length,
  };
}

function DeleteDraft({ visitId }: { visitId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      clearBackup(visitId);
      // On success the action redirects to /visits.
      const result = await deleteVisit(visitId);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        onClick={() => setOpen(true)}
        className="h-12 self-start text-base"
      >
        <Trash2 /> Delete draft
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              All shelf checks and staff feedback in this visit are deleted
              too. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
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
