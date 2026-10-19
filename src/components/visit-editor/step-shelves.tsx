"use client";

import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { ChevronDown, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  isShelfChanged,
  shelfKey,
  ZONE_ORDER,
  type ShelfValue,
  type VisitFormValues,
} from "@/lib/visit-form";
import type { EditorShelf } from "@/lib/visits";
import { BulkSetDrawer } from "./bulk-set-drawer";
import { ShelfCard } from "./shelf-card";

type Filter = "all" | "mould" | "changed" | "unchecked";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "mould", label: "Mould" },
  { id: "changed", label: "Changed" },
  { id: "unchecked", label: "Not checked" },
];

function matches(filter: Filter, value: ShelfValue | undefined, shelf: EditorShelf) {
  if (filter === "all") return true;
  if (!value) return filter === "unchecked";
  if (filter === "mould") return value.condition === "mould";
  if (filter === "changed") return isShelfChanged(value, shelf.previous);
  return value.condition === null;
}

// Step 1: every shelf of the hub, grouped by zone, with filters and bulk set.
export function StepShelves({
  shelves,
  readOnly,
}: {
  shelves: EditorShelf[];
  readOnly: boolean;
}) {
  const { control } = useFormContext<VisitFormValues>();
  const values = useWatch({ control, name: "shelves" });
  const [filter, setFilter] = useState<Filter>("all");
  const [bulkOpen, setBulkOpen] = useState(false);

  const counts = Object.fromEntries(
    FILTERS.map((f) => [
      f.id,
      shelves.filter((s) => matches(f.id, values[shelfKey(s.number)], s)).length,
    ]),
  ) as Record<Filter, number>;

  const groups = ZONE_ORDER.map(({ zone, label }) => ({
    zone,
    label,
    all: shelves.filter((s) => s.zone === zone),
    shown: shelves.filter(
      (s) => s.zone === zone && matches(filter, values[shelfKey(s.number)], s),
    ),
  })).filter((g) => g.all.length > 0);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filter shelves" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors",
                filter === f.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted",
              )}
            >
              {f.label}
              <span className={cn("text-xs", filter !== f.id && "text-muted-foreground")}>
                {counts[f.id]}
              </span>
            </button>
          ))}
        </div>
        {!readOnly && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setBulkOpen(true)}
            className="h-10 md:ml-auto"
          >
            <ListChecks /> Bulk set
          </Button>
        )}
      </div>

      {groups.every((g) => g.shown.length === 0) && (
        <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
          No shelves match this filter.
        </p>
      )}

      {groups.map(
        (group) =>
          group.shown.length > 0 && (
            // <details> is a native collapsible section: no JavaScript needed.
            <details key={group.zone} open className="group/zone">
              <summary className="sticky top-14 z-[5] -mx-4 flex h-11 cursor-pointer list-none items-center [&::-webkit-details-marker]:hidden gap-2 bg-background/95 px-4 font-semibold backdrop-blur md:top-0">
                <ChevronDown className="size-4 transition-transform group-[:not([open])]/zone:-rotate-90" />
                {group.label}
                <span className="text-sm font-normal text-muted-foreground">
                  {filter === "all"
                    ? group.all.length
                    : `${group.shown.length} of ${group.all.length}`}
                </span>
              </summary>
              <div className="grid gap-3 pt-2 md:grid-cols-2 xl:grid-cols-3">
                {group.shown.map((shelf) => (
                  <ShelfCard key={shelf.id} shelf={shelf} readOnly={readOnly} />
                ))}
              </div>
            </details>
          ),
      )}

      {!readOnly && (
        <BulkSetDrawer shelves={shelves} open={bulkOpen} onOpenChange={setBulkOpen} />
      )}
    </section>
  );
}
