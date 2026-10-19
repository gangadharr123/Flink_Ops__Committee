"use client";

import type { EditorShelf } from "@/lib/visits";

export function StepShelves({ shelves }: { shelves: EditorShelf[]; readOnly: boolean }) {
  return <p className="text-muted-foreground">{shelves.length} shelves (next step).</p>;
}
