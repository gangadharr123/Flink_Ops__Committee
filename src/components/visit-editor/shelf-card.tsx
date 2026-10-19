"use client";

import { memo, useState } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { MessageSquarePlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { conditionClass } from "./condition-style";

const conditionLabel = (c: string) => CONDITIONS.find((x) => x.value === c)?.label ?? c;

// One shelf. memo + its own useWatch means typing in one card re-renders
// only that card, not all 70.
export const ShelfCard = memo(function ShelfCard({
  shelf,
  readOnly,
}: {
  shelf: EditorShelf;
  readOnly: boolean;
}) {
  const key = shelfKey(shelf.number);
  const { control, register } = useFormContext<VisitFormValues>();
  const value = useWatch({ control, name: `shelves.${key}` });
  const [commentOpen, setCommentOpen] = useState(false);

  const changed = isShelfChanged(value, shelf.previous);
  const scoreInvalid = parseScore(value.score) === "invalid";
  const noCondition = value.condition === null;
  const showComment = commentOpen || value.comment !== "";

  return (
    <article
      aria-label={`Shelf ${shelf.number}`}
      className={cn(
        "flex flex-col gap-2.5 rounded-xl border bg-card p-3",
        changed && "border-primary bg-primary/5 ring-1 ring-primary",
      )}
    >
      <header className="flex items-center gap-2">
        <h3 className="font-semibold">Shelf {shelf.number}</h3>
        {shelf.zoneConfidence === "check" && (
          <Badge variant="outline" title="Zone not confirmed, check on site">
            zone?
          </Badge>
        )}
        {changed && <Badge>changed</Badge>}
        {shelf.previous && (
          <span className="ml-auto truncate text-xs text-muted-foreground">
            Last: {conditionLabel(shelf.previous.condition)}
            {shelf.previous.score !== null && ` · ${shelf.previous.score}`}
          </span>
        )}
      </header>

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
            selectedClassName={conditionClass}
          />
        )}
      />

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-sm">
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
        {!showComment && !readOnly && (
          <button
            type="button"
            onClick={() => setCommentOpen(true)}
            disabled={noCondition}
            className="ml-auto flex h-11 items-center gap-1.5 rounded-lg px-3 text-sm text-muted-foreground enabled:hover:bg-muted disabled:opacity-50"
          >
            <MessageSquarePlus className="size-4" /> Comment
          </button>
        )}
      </div>
      {scoreInvalid && (
        <p className="text-xs text-destructive">Score must be 0 to 5, e.g. 3.5</p>
      )}

      {showComment && (
        <Textarea
          rows={2}
          readOnly={readOnly}
          disabled={!readOnly && noCondition}
          placeholder="Comment"
          aria-label={`Shelf ${shelf.number} comment`}
          // focus only right after tapping "Comment"
          autoFocus={commentOpen && value.comment === ""}
          {...register(`shelves.${key}.comment`)}
        />
      )}
      {shelf.previous?.comment && (
        <p className="text-xs text-muted-foreground">
          Last time: {shelf.previous.comment}
        </p>
      )}
    </article>
  );
});
