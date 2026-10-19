"use client";

export function StepStaff({ suggestions }: { suggestions: string[]; readOnly: boolean }) {
  return <p className="text-muted-foreground">{suggestions.length} known topics (next step).</p>;
}
