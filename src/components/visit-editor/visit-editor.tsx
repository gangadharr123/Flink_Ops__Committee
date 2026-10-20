"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import Link from "next/link";
import { ClipboardCopy, CloudOff, FileDown, X } from "lucide-react";
import { submitVisit } from "@/app/(app)/visits/actions";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { useOnline } from "@/lib/use-online";
import { cn } from "@/lib/utils";
import { shelfKey, STEPS, type VisitFormValues, type VisitStep } from "@/lib/visit-form";
import type { VisitEditorData } from "@/lib/visits";
import { ActionBar } from "./action-bar";
import { StepIssues } from "./step-issues";
import { StepProgress } from "./step-progress";
import { StepShelves } from "./step-shelves";
import { StepStaff } from "./step-staff";
import { StepSummary } from "./step-summary";
import { SubmitDialog } from "./submit-dialog";
import { clearBackup, readBackup, useAutosave } from "./use-autosave";

// The whole visit form lives in one React Hook Form instance. The steps are
// just different views of it, so switching steps is instant and nothing is
// lost; autosave sends whatever changed.
export function VisitEditor({
  data,
  canEdit,
}: {
  data: VisitEditorData;
  canEdit: boolean;
}) {
  const { visit } = data;
  const router = useRouter();
  const readOnly = !canEdit || visit.status !== "draft";

  const form = useForm<VisitFormValues>({ defaultValues: data.values });
  const shelfIds = useMemo(
    () => Object.fromEntries(data.shelves.map((s) => [shelfKey(s.number), s.id])),
    [data.shelves],
  );
  const autosave = useAutosave({
    form,
    visitId: visit.id,
    shelfIds,
    initial: data.values,
    enabled: !readOnly,
  });

  // Drafts reopen where you left off; submitted visits open at the start.
  const [step, setStep] = useState<VisitStep>(
    readOnly ? "shelves" : visit.currentStep,
  );
  const [restored, setRestored] = useState(false);
  const online = useOnline();
  const [submitOpen, setSubmitOpen] = useState(false);
  // New issues are saved straight away (not autosaved), so they live here.
  const [newIssues, setNewIssues] = useState(data.newIssues);
  const [leaving, startLeaving] = useTransition();

  // Changes that never reached the server (e.g. signal dropped) are kept on
  // the phone. Put them back into the form; autosave then sends them.
  useEffect(() => {
    if (readOnly) return;
    const backup = readBackup(visit.id);
    if (backup && JSON.stringify(backup) !== JSON.stringify(data.values)) {
      // Older backups may lack newer parts of the form (e.g. issues).
      form.reset({
        ...data.values,
        ...backup,
        stock_and_space: backup.stock_and_space ?? data.values.stock_and_space,
        issues: { ...data.values.issues, ...backup.issues },
      });
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off notice after reading localStorage, which only exists in the browser
      setRestored(true);
    }
  }, [readOnly, visit.id, data.values, form]);

  const index = STEPS.findIndex((s) => s.id === step);

  function goTo(next: VisitStep) {
    setStep(next);
    window.scrollTo({ top: 0 });
    void autosave.saveNow({ current_step: next });
  }

  function leave() {
    startLeaving(async () => {
      await autosave.saveNow();
      router.push("/visits");
    });
  }

  async function submit(): Promise<string | null> {
    if (!(await autosave.saveNow())) return autosave.error ?? "Could not save.";
    const result = await submitVisit(visit.id);
    if (result.error) return result.error;
    clearBackup(visit.id);
    router.refresh();
    return null;
  }

  return (
    <FormProvider {...form}>
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <header className="flex items-start gap-2">
          <button
            type="button"
            onClick={leave}
            disabled={leaving}
            aria-label="Close visit"
            className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-muted"
          >
            <X className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold">
              {visit.hubName} · {visit.label}
            </h1>
            <p className="text-sm text-muted-foreground">
              {formatDate(visit.visitDate)}
            </p>
          </div>
          <Badge variant={visit.status === "draft" ? "outline" : "secondary"}>
            {visit.status === "draft" ? "Draft" : "Submitted"}
          </Badge>
          {visit.status === "draft" && (
            // Drafts: Airtable answers are available too, saved first.
            <button
              type="button"
              onClick={() =>
                startLeaving(async () => {
                  await autosave.saveNow();
                  router.push(`/visits/${visit.id}/airtable`);
                })
              }
              aria-label="Airtable answers"
              title="Airtable answers"
              className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-muted"
            >
              <ClipboardCopy className="size-5" />
            </button>
          )}
        </header>

        <StepProgress current={step} onSelect={goTo} />

        {!online && !readOnly && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200"
          >
            <CloudOff className="mt-0.5 size-4 shrink-0" />
            You&apos;re offline. Changes are kept on this phone and sync when you&apos;re back
            online. Adding issues or photos, submitting and deleting need a connection.
          </p>
        )}
        {restored && (
          <p className="rounded-lg bg-muted p-3 text-sm" role="status">
            Restored changes from this device that were not saved yet.
          </p>
        )}
        {readOnly && (
          <div className="flex flex-col gap-3 rounded-lg bg-muted p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p>
              {visit.status === "submitted"
                ? `Submitted${visit.submittedAt ? ` on ${formatDate(visit.submittedAt.slice(0, 10))}` : ""}. This visit is read-only.`
                : "Read-only: your role can't edit visits."}
            </p>
            {visit.status === "submitted" && (
              <div className="flex flex-col gap-2 sm:flex-row">
                {/* A plain link (not next/link): the browser downloads the file. */}
                <a
                  href={`/visits/${visit.id}/report`}
                  download
                  className={cn(buttonVariants(), "h-12 shrink-0 text-base")}
                >
                  <FileDown /> Download report
                </a>
                <Link
                  href={`/visits/${visit.id}/airtable`}
                  className={cn(buttonVariants({ variant: "outline" }), "h-12 shrink-0 text-base")}
                >
                  <ClipboardCopy /> Airtable answers
                </Link>
              </div>
            )}
          </div>
        )}

        {step === "shelves" && <StepShelves shelves={data.shelves} readOnly={readOnly} />}
        {step === "issues" && (
          <StepIssues
            visitId={visit.id}
            hubName={visit.hubName}
            openIssues={data.openIssues}
            newIssues={newIssues}
            onNewIssuesChange={setNewIssues}
            readOnly={readOnly}
          />
        )}
        {step === "staff" && (
          <StepStaff suggestions={data.topicSuggestions} readOnly={readOnly} />
        )}
        {step === "summary" && (
          <StepSummary
            shelves={data.shelves}
            openIssues={data.openIssues}
            newIssueCount={newIssues.length}
            visitId={visit.id}
            readOnly={readOnly}
            canDelete={canEdit && visit.status === "draft"}
          />
        )}
      </div>

      <ActionBar
        status={readOnly ? null : autosave.status}
        error={autosave.error}
        onSave={() => void autosave.saveNow()}
        onBack={index > 0 ? () => goTo(STEPS[index - 1].id) : undefined}
        onNext={index < STEPS.length - 1 ? () => goTo(STEPS[index + 1].id) : undefined}
        onSubmit={!readOnly && step === "summary" ? () => setSubmitOpen(true) : undefined}
      />

      <SubmitDialog
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        shelves={data.shelves}
        openIssues={data.openIssues}
        label={visit.label}
        onConfirm={submit}
      />
    </FormProvider>
  );
}
