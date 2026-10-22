// The app's only colours: a small dot next to a text label.
//   critical (red)   immediate issues, mould
//   warning (amber)  dusty, open, draft
//   neutral (grey)   everything else
// Colour never carries meaning alone: the text always says it too.
import type { Severity } from "@/lib/issues";
import { cn } from "@/lib/utils";
import type { Condition } from "@/lib/visit-form";

export type Tone = "critical" | "warning" | "neutral";

const DOT: Record<Tone, string> = {
  critical: "bg-state-critical",
  warning: "bg-state-warning",
  neutral: "bg-state-neutral",
};

export function StateDot({ tone, className }: { tone: Tone; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-full print:border print:border-black", DOT[tone], className)}
    />
  );
}

// "● Dusty": dot + text, in the surrounding text size.
export function StateLabel({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap", className)}>
      <StateDot tone={tone} />
      {children}
    </span>
  );
}

export function conditionTone(condition: Condition): Tone {
  if (condition === "mould") return "critical";
  if (condition === "dusty" || condition === "minor_dust") return "warning";
  return "neutral";
}

export function severityTone(severity: Severity): Tone {
  return severity === "immediate" ? "critical" : "neutral";
}

// Issue update states and issue/visit status: open things are amber.
export function openTone(isOpen: boolean): Tone {
  return isOpen ? "warning" : "neutral";
}
