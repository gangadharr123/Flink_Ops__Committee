"use client";

import { useState } from "react";
import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { ShieldAlert, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { uuid } from "@/lib/uuid";
import { STAFF_ROLES, type VisitFormValues } from "@/lib/visit-form";
import { ChoiceChips } from "./choice-chips";
import { TopicInput } from "./topic-input";

const YES_NO = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
] as const;

// Step 3: one card per person spoken to. Role and tenure only, never names.
export function StepStaff({
  suggestions,
  readOnly,
}: {
  suggestions: string[];
  readOnly: boolean;
}) {
  const { control } = useFormContext<VisitFormValues>();
  // keyName: our cards already have an "id" (the database id), so React Hook
  // Form keeps its own internal key under a different name.
  const { fields, append, remove } = useFieldArray({
    control,
    name: "staff",
    keyName: "fieldKey",
  });
  const staff = useWatch({ control, name: "staff" });

  // Tags from earlier visits plus any added in this visit, most used first.
  const allTags = [...new Set([...suggestions, ...staff.flatMap((s) => s.topics)])];

  function addPerson() {
    append({
      id: uuid(),
      staff_role: null,
      returning: false,
      tenure_note: "",
      points: "",
      topics: [],
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <p
        role="note"
        className="flex items-start gap-2 rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 text-sm font-medium text-amber-900 dark:text-amber-200"
      >
        <ShieldAlert className="mt-0.5 size-5 shrink-0" />
        No names, nothing private. Describe people by role and tenure only.
      </p>

      {fields.length === 0 && (
        <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
          No staff feedback yet.
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {fields.map((field, index) => (
          <StaffCard
            key={field.fieldKey}
            index={index}
            tags={allTags}
            readOnly={readOnly}
            onRemove={() => remove(index)}
          />
        ))}
      </div>

      {!readOnly && (
        <Button
          type="button"
          variant="outline"
          onClick={addPerson}
          className="h-12 self-stretch text-base sm:self-start"
        >
          <UserPlus /> Add person
        </Button>
      )}
    </section>
  );
}

function StaffCard({
  index,
  tags,
  readOnly,
  onRemove,
}: {
  index: number;
  tags: string[];
  readOnly: boolean;
  onRemove: () => void;
}) {
  const { control, register } = useFormContext<VisitFormValues>();
  const role = useWatch({ control, name: `staff.${index}.staff_role` });
  const [confirmRemove, setConfirmRemove] = useState(false);
  const idPrefix = `staff-${index}`;

  return (
    <article className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <header className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">Person {index + 1}</h3>
        {!readOnly &&
          (confirmRemove ? (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConfirmRemove(false)}
                className="h-10"
              >
                Keep
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={onRemove}
                className="h-10"
              >
                Remove
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setConfirmRemove(true)}
              aria-label={`Remove person ${index + 1}`}
              className="size-10"
            >
              <Trash2 />
            </Button>
          ))}
      </header>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Role</span>
        <Controller
          control={control}
          name={`staff.${index}.staff_role`}
          render={({ field }) => (
            <ChoiceChips
              label="Role"
              options={STAFF_ROLES}
              value={field.value}
              onChange={(v) => field.onChange(v ?? field.value)}
              disabled={readOnly}
              className="grid-cols-3 sm:grid-cols-5"
            />
          )}
        />
        {role === null && !readOnly && (
          <p className="text-xs text-destructive">Pick a role to save this card.</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Spoke to them on an earlier visit?</span>
        <Controller
          control={control}
          name={`staff.${index}.returning`}
          render={({ field }) => (
            <ChoiceChips
              label="Returning"
              options={[...YES_NO]}
              value={field.value ? "yes" : "no"}
              onChange={(v) => field.onChange(v === "yes")}
              disabled={readOnly}
              className="grid-cols-2"
            />
          )}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-tenure`}>Tenure</Label>
        <Input
          id={`${idPrefix}-tenure`}
          readOnly={readOnly}
          placeholder="e.g. about 1 month, recently joined"
          className="h-11 text-base"
          {...register(`staff.${index}.tenure_note`)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-points`}>What they said</Label>
        <Textarea
          id={`${idPrefix}-points`}
          rows={3}
          readOnly={readOnly}
          placeholder="Main points, in your words"
          {...register(`staff.${index}.points`)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Topics</span>
        <Controller
          control={control}
          name={`staff.${index}.topics`}
          render={({ field }) => (
            <TopicInput
              value={field.value}
              onChange={field.onChange}
              suggestions={tags}
              disabled={readOnly}
            />
          )}
        />
      </div>
    </article>
  );
}
