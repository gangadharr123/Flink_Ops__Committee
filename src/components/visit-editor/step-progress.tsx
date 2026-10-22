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
    <ol className="grid grid-cols-4 gap-2" aria-label="Visit steps">
      {STEPS.map((step, i) => (
        <li key={step.id}>
          <button
            type="button"
            onClick={() => onSelect(step.id)}
            aria-current={i === currentIndex ? "step" : undefined}
            className="flex min-h-11 w-full flex-col items-center justify-center gap-2"
          >
            <span
              className={cn(
                "h-0.5 w-full rounded-full",
                i <= currentIndex ? "bg-foreground" : "bg-border",
              )}
            />
            <span
              className={cn(
                "text-sm",
                i === currentIndex ? "font-medium" : "text-muted-foreground",
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
