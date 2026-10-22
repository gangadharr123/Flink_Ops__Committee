"use client";

import { memo } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { ChevronDown } from "lucide-react";
import { conditionTone, StateLabel } from "@/components/state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  CONDITIONS,
  isShelfChanged,
  parseScore,
  shelfKey,
  type VisitFormValues,
} from "@/lib/visit-form";
import type { EditorShelf } from "@/lib/visits";
import { ChoiceChips } from "./choice-chips";

const conditionLabel = (c: string) => CONDITIONS.find((x) => x.value === c)?.label ?? c;

// One shelf. Compact row by default ("Shelf 12 · ● Dusty · 3.5/5"); tap it
// to open the condition chips, score and comment. memo + its own useWatch
// means a change re-renders only this shelf, not all 70.
export const ShelfCard = memo(function ShelfCard({
  shelf,
  readOnly,
  open,
  onToggle,
}: {
  shelf: EditorShelf;
  readOnly: boolean;
  open: boolean;
  onToggle: (key: string) => void;
}) {
  const key = shelfKey(shelf.number);
  const { control, register } = useFormContext<VisitFormValues>();
  const value = useWatch({ control, name: `shelves.${key}` });

  const score = parseScore(value.score);
  const scoreInvalid = score === "invalid";
  const noCondition = value.condition === null;
  // "changed" only means something while editing a draft, not on
  // submitted or imported visits.
  const changed = !readOnly && isShelfChanged(value, shelf.previous);

  return (
    <article
      aria-label={`Shelf ${shelf.number}`}
      className={cn("rounded-lg border", changed && "border-foreground/40")}
    >
      <button
        type="button"
        onClick={() => onToggle(key)}
        aria-expanded={open}
        className="flex min-h-12 w-full flex-col justify-center gap-1 px-4 py-2 text-left"
      >
        <span className="flex w-full items-center gap-2">
          <span className="font-medium">Shelf {shelf.number}</span>
          <span className="text-muted-foreground">·</span>
          {value.condition ? (
            <StateLabel tone={conditionTone(value.condition)}>
              {conditionLabel(value.condition)}
            </StateLabel>
          ) : (
            <span className="text-muted-foreground">Not checked</span>
          )}
          {typeof score === "number" && (
            <span className="text-muted-foreground">· {score}/5</span>
          )}
          {scoreInvalid && <span className="text-sm text-destructive">· check score</span>}
          <span className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            {changed && <span>changed</span>}
            <ChevronDown
              aria-hidden
              className={cn("size-4 transition-transform print:hidden", open && "rotate-180")}
            />
          </span>
        </span>
        {!open && value.comment.trim() && (
          <span className="truncate text-sm text-muted-foreground print:whitespace-normal">
            {value.comment}
          </span>
        )}
      </button>

      {open && (
        <div className="flex flex-col gap-4 border-t px-4 py-4 print:hidden">
          {(shelf.previous || shelf.zoneConfidence === "check") && (
            <p className="text-sm text-muted-foreground">
              {shelf.previous && (
                <>
                  Last time: {conditionLabel(shelf.previous.condition)}
                  {shelf.previous.score !== null && `, ${shelf.previous.score}/5`}
                  {shelf.previous.comment && `. ${shelf.previous.comment}`}
                </>
              )}
              {shelf.previous && shelf.zoneConfidence === "check" && " · "}
              {shelf.zoneConfidence === "check" && "Zone not confirmed, check on site"}
            </p>
          )}

          <Controller
            control={control}
            name={`shelves.${key}.condition`}
            render={({ field }) => (
              <ChoiceChips
                label={`Shelf ${shelf.number} condition`}
                options={CONDITIONS}
                value={field.value}
                onChange={field.onChange}
                allowClear
                disabled={readOnly}
                className="grid-cols-5"
                tone={conditionTone}
              />
            )}
          />

          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Score</span>
            <Input
              inputMode="decimal"
              autoComplete="off"
              placeholder="-"
              disabled={readOnly || noCondition}
              aria-invalid={scoreInvalid || undefined}
              aria-label={`Shelf ${shelf.number} score out of 5`}
              className="h-11 w-16 text-center text-base"
              {...register(`shelves.${key}.score`)}
            />
            <span className="text-muted-foreground">/ 5</span>
          </label>
          {scoreInvalid && (
            <p className="text-sm text-destructive">Score must be 0 to 5, e.g. 3.5</p>
          )}

          <Textarea
            rows={2}
            readOnly={readOnly}
            disabled={!readOnly && noCondition}
            placeholder={noCondition ? "Pick a condition first" : "Comment (optional)"}
            aria-label={`Shelf ${shelf.number} comment`}
            {...register(`shelves.${key}.comment`)}
          />
        </div>
      )}
    </article>
  );
});
