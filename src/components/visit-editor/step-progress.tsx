"use client";

import { STEPS, type VisitStep } from "@/lib/visit-form";
import { cn } from "@/lib/utils";

// 1 Shelves · 2 Issues · 3 Staff · 4 Summary. Tap a step to jump to it.
export function StepProgress({
  current,
  onSelect,
}: {
  current: VisitStep;
  onSelect: (step: VisitStep) => void;
}) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);
  return (
    <ol className="grid grid-cols-4 gap-1" aria-label="Visit steps">
      {STEPS.map((step, i) => (
        <li key={step.id}>
          <button
            type="button"
            onClick={() => onSelect(step.id)}
            aria-current={i === currentIndex ? "step" : undefined}
            className="flex w-full flex-col items-center gap-1.5 py-1"
          >
            <span
              className={cn(
                "h-1.5 w-full rounded-full",
                i <= currentIndex ? "bg-primary" : "bg-muted",
              )}
            />
            <span
              className={cn(
                "text-xs",
                i === currentIndex ? "font-semibold" : "text-muted-foreground",
              )}
            >
              {i + 1} {step.label}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}
