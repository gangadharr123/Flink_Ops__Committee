"use client";

import { useMemo, useState } from "react";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CONDITIONS,
  parseScore,
  parseShelfRange,
  shelfKey,
  type Condition,
  type VisitFormValues,
} from "@/lib/visit-form";
import type { EditorShelf } from "@/lib/visits";
import { ChoiceChips } from "./choice-chips";
import { conditionClass } from "./condition-style";

// Bottom sheet: "1-8 dusty, score 3, comment: dust on upper racks".
// Empty score or comment leaves what each shelf already has.
export function BulkSetDrawer({
  shelves,
  open,
  onOpenChange,
}: {
  shelves: EditorShelf[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { setValue } = useFormContext<VisitFormValues>();
  const [range, setRange] = useState("");
  const [condition, setCondition] = useState<Condition | null>(null);
  const [score, setScore] = useState("");
  const [comment, setComment] = useState("");

  const existing = useMemo(() => new Set(shelves.map((s) => s.number)), [shelves]);
  const parsed = range.trim() ? parseShelfRange(range, existing) : null;
  const scoreInvalid = parseScore(score) === "invalid";
  const numbers = parsed && "numbers" in parsed ? parsed.numbers : [];
  const canApply = numbers.length > 0 && condition !== null && !scoreInvalid;

  function apply() {
    if (!canApply) return;
    const opts = { shouldDirty: true };
    for (const n of numbers) {
      const key = shelfKey(n);
      setValue(`shelves.${key}.condition`, condition, opts);
      if (score.trim()) setValue(`shelves.${key}.score`, score.trim(), opts);
      if (comment.trim()) setValue(`shelves.${key}.comment`, comment.trim(), opts);
    }
    setRange("");
    setScore("");
    setComment("");
    setCondition(null);
    onOpenChange(false);
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto flex w-full max-w-lg flex-col overflow-y-auto">
          <DrawerHeader>
            <DrawerTitle>Bulk set shelves</DrawerTitle>
            <DrawerDescription>
              Empty score or comment keeps what each shelf already has.
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="bulk-range">Shelves</Label>
              <Input
                id="bulk-range"
                value={range}
                onChange={(e) => setRange(e.target.value)}
                placeholder="e.g. 1-8, 12, 15-17"
                inputMode="text"
                autoComplete="off"
                className="h-12 text-base"
                aria-invalid={(parsed && "error" in parsed) || undefined}
              />
              {parsed && "error" in parsed && (
                <p className="text-sm text-destructive">{parsed.error}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Condition</span>
              <ChoiceChips
                label="Condition for selected shelves"
                options={CONDITIONS}
                value={condition}
                onChange={setCondition}
                className="grid-cols-5"
                selectedClassName={conditionClass}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="bulk-score">Score out of 5 (optional)</Label>
              <Input
                id="bulk-score"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                inputMode="decimal"
                autoComplete="off"
                className="h-12 w-24 text-base"
                aria-invalid={scoreInvalid || undefined}
              />
              {scoreInvalid && (
                <p className="text-sm text-destructive">Score must be 0 to 5, e.g. 3.5</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="bulk-comment">Comment (optional)</Label>
              <Textarea
                id="bulk-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                placeholder="e.g. dust on upper racks"
              />
            </div>
          </div>

          <DrawerFooter className="pb-[calc(max(1rem,env(safe-area-inset-bottom))+var(--badge-clearance))]">
            <Button type="button" onClick={apply} disabled={!canApply} className="h-12 text-base">
              {numbers.length > 0
                ? `Apply to ${numbers.length} shelf${numbers.length === 1 ? "" : "s"}`
                : "Apply"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-12 text-base"
            >
              Cancel
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
