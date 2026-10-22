"use client";

import { useCallback, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { ChevronDown, ListChecks } from "lucide-react";
import { chipClass } from "@/components/chip-style";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
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
  // One shelf open at a time; tapping it again closes it.
  const [openKey, setOpenKey] = useState<string | null>(null);
  const toggle = useCallback((key: string) => setOpenKey((k) => (k === key ? null : key)), []);

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
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <div role="group" aria-label="Filter shelves" className="flex flex-wrap gap-2">
          {/* "Changed" only applies while editing a draft. */}
          {FILTERS.filter((f) => !(readOnly && f.id === "changed")).map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={chipClass(filter === f.id)}
            >
              {f.label}
              <span className="text-muted-foreground">{counts[f.id]}</span>
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
        <EmptyState
          action={
            <Button type="button" variant="outline" onClick={() => setFilter("all")} className="h-10">
              Show all shelves
            </Button>
          }
        >
          No shelves match this filter.
        </EmptyState>
      )}

      {groups.map(
        (group) =>
          group.shown.length > 0 && (
            // <details> is a native collapsible section: no JavaScript needed.
            <details key={group.zone} open className="group/zone">
              <summary className="sticky top-14 z-[5] -mx-4 flex h-12 cursor-pointer list-none items-center gap-2 bg-background px-4 font-semibold md:top-0 print:static [&::-webkit-details-marker]:hidden">
                <ChevronDown className="size-4 transition-transform group-[:not([open])]/zone:-rotate-90 print:hidden" />
                {group.label}
                <span className="text-sm font-normal text-muted-foreground">
                  {filter === "all"
                    ? group.all.length
                    : `${group.shown.length} of ${group.all.length}`}
                </span>
              </summary>
              <div className="grid items-start gap-2 pt-2 md:grid-cols-2 xl:grid-cols-3">
                {group.shown.map((shelf) => (
                  <ShelfCard
                    key={shelf.id}
                    shelf={shelf}
                    readOnly={readOnly}
                    open={openKey === shelfKey(shelf.number)}
                    onToggle={toggle}
                  />
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
