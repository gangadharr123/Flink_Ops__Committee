"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { X } from "lucide-react";
import { submitVisit } from "@/app/(app)/visits/actions";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
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
        </header>

        <StepProgress current={step} onSelect={goTo} />

        {restored && (
          <p className="rounded-lg bg-muted p-3 text-sm" role="status">
            Restored changes from this device that were not saved yet.
          </p>
        )}
        {readOnly && (
          <p className="rounded-lg bg-muted p-3 text-sm">
            {visit.status === "submitted"
              ? `Submitted${visit.submittedAt ? ` on ${formatDate(visit.submittedAt.slice(0, 10))}` : ""}. This visit is read-only.`
              : "Read-only: your role can't edit visits."}
          </p>
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
