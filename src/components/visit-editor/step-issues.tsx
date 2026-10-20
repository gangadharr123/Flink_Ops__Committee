"use client";

import { memo, useState, useTransition } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { deleteIssue } from "@/app/(app)/visits/actions";
import { ExcludedBadge, RecurringBadge, SeverityBadge } from "@/components/issues/issue-badges";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format";
import { useOnline } from "@/lib/use-online";
import { CATEGORY_LABELS, UPDATE_STATES } from "@/lib/issues";
import {
  issueFormKey,
  type IssueUpdateChoice,
  type VisitFormValues,
} from "@/lib/visit-form";
import type { EditorIssue, NewIssue } from "@/lib/visits";
import { ChoiceChips } from "./choice-chips";
import { IssuePhotos } from "./issue-photos";
import { NewIssueDrawer } from "./new-issue-drawer";

const CHOICES: { value: IssueUpdateChoice; label: string }[] = [
  { value: "still_open", label: "Still open" },
  { value: "improved", label: "Improved" },
  { value: "resolved", label: "Resolved" },
];

const choiceClass = (v: IssueUpdateChoice) =>
  v === "resolved"
    ? "border-emerald-600 bg-emerald-600 text-white"
    : v === "improved"
      ? "border-sky-600 bg-sky-600 text-white"
      : "border-amber-600 bg-amber-600 text-white";

const stateLabel = (s: string) => UPDATE_STATES.find((x) => x.value === s)?.label ?? s;

// Step 2: update every issue that was already open, then add new ones.
export function StepIssues({
  visitId,
  hubName,
  openIssues,
  newIssues,
  onNewIssuesChange,
  readOnly,
}: {
  visitId: string;
  hubName: string;
  openIssues: EditorIssue[];
  newIssues: NewIssue[];
  onNewIssuesChange: (issues: NewIssue[]) => void;
  readOnly: boolean;
}) {
  const { control } = useFormContext<VisitFormValues>();
  const updates = useWatch({ control, name: "issues" });
  const updated = openIssues.filter((i) => updates[issueFormKey(i.id)]?.state).length;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const online = useOnline();

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Open issues at {hubName}</h2>
          {openIssues.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {updated} of {openIssues.length} updated
            </span>
          )}
        </div>
        {openIssues.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
            No open issues from earlier visits.
          </p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {openIssues.map((issue) => (
              <OpenIssueCard
                key={issue.id}
                issue={issue}
                visitId={visitId}
                readOnly={readOnly}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">New this visit</h2>
        {newIssues.length === 0 && (
          <p className="text-sm text-muted-foreground">No new issues yet.</p>
        )}
        <div className="grid gap-3 lg:grid-cols-2">
          {newIssues.map((issue) => (
            <NewIssueCard
              key={issue.id}
              issue={issue}
              visitId={visitId}
              readOnly={readOnly}
              onDeleted={() => onNewIssuesChange(newIssues.filter((i) => i.id !== issue.id))}
            />
          ))}
        </div>
        {!readOnly && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setDrawerOpen(true)}
            disabled={!online}
            title={online ? undefined : "Needs a connection"}
            className="h-12 text-base sm:self-start"
          >
            <Plus /> Add new issue
          </Button>
        )}
      </div>

      {!readOnly && (
        <NewIssueDrawer
          visitId={visitId}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          onCreated={(issue) => onNewIssuesChange([...newIssues, issue])}
        />
      )}
    </section>
  );
}

function IssueHeading({ issue }: { issue: EditorIssue | NewIssue }) {
  return (
    <header className="flex flex-col gap-1.5">
      <h3 className="font-semibold leading-snug">{issue.title}</h3>
      <div className="flex flex-wrap items-center gap-1.5">
        <SeverityBadge severity={issue.severity} />
        <span className="text-xs text-muted-foreground">{CATEGORY_LABELS[issue.category]}</span>
        {issue.isRecurring && <RecurringBadge visits={issue.visitsSeen} />}
        {issue.excluded && <ExcludedBadge />}
      </div>
    </header>
  );
}

const OpenIssueCard = memo(function OpenIssueCard({
  issue,
  visitId,
  readOnly,
}: {
  issue: EditorIssue;
  visitId: string;
  readOnly: boolean;
}) {
  const key = issueFormKey(issue.id);
  const { control, register } = useFormContext<VisitFormValues>();
  const value = useWatch({ control, name: `issues.${key}` });
  const noteWithoutState = value.state === null && value.note.trim() !== "";

  return (
    <article className="flex flex-col gap-3 rounded-xl border bg-card p-3">
      <IssueHeading issue={issue} />
      {issue.last && (
        <p className="text-xs text-muted-foreground">
          Last: {stateLabel(issue.last.state)} on {issue.last.label ?? "visit"} (
          {formatDate(issue.last.date)})
          {issue.last.note && ` · ${issue.last.note}`}
        </p>
      )}
      <Controller
        control={control}
        name={`issues.${key}.state`}
        render={({ field }) => (
          <ChoiceChips
            label={`Update for ${issue.title}`}
            options={CHOICES}
            value={field.value}
            onChange={field.onChange}
            allowClear
            disabled={readOnly}
            className="grid-cols-3"
            selectedClassName={choiceClass}
          />
        )}
      />
      {(value.state !== null || value.note !== "") && (
        <Textarea
          rows={2}
          readOnly={readOnly}
          placeholder="Note (optional)"
          aria-label={`Note for ${issue.title}`}
          {...register(`issues.${key}.note`)}
        />
      )}
      {noteWithoutState && (
        <p className="text-xs text-destructive">Pick a state to save the note.</p>
      )}
      <IssuePhotos
        visitId={visitId}
        issueId={issue.id}
        initial={issue.photos}
        alt={issue.title}
        readOnly={readOnly}
      />
    </article>
  );
});

function NewIssueCard({
  issue,
  visitId,
  readOnly,
  onDeleted,
}: {
  issue: NewIssue;
  visitId: string;
  readOnly: boolean;
  onDeleted: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const online = useOnline();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const result = await deleteIssue(visitId, issue.id);
      if (result.error) setError(result.error);
      else onDeleted();
    });
  }

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-primary/40 bg-primary/5 p-3">
      <IssueHeading issue={issue} />
      {issue.description && <p className="text-sm whitespace-pre-line">{issue.description}</p>}
      <IssuePhotos
        visitId={visitId}
        issueId={issue.id}
        initial={issue.photos}
        alt={issue.title}
        readOnly={readOnly}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!readOnly && (
        <div className="flex justify-end gap-2">
          {confirm ? (
            <>
              <Button type="button" variant="ghost" onClick={() => setConfirm(false)} className="h-10">
                Keep
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={remove}
                disabled={pending}
                className="h-10"
              >
                {pending ? "Deleting..." : "Delete issue"}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirm(true)}
              disabled={!online}
              className="h-10 text-muted-foreground"
            >
              <Trash2 /> Delete
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
