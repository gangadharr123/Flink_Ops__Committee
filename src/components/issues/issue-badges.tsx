// Issue labels: severity as dot + text (red only for Immediate), the rest
// as plain grey text.
import { severityTone, StateLabel } from "@/components/state";
import { recurringLabel, SEVERITIES, type Severity } from "@/lib/issues";

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <StateLabel tone={severityTone(severity)} className="text-sm">
      {SEVERITIES.find((s) => s.value === severity)?.label}
    </StateLabel>
  );
}

export function RecurringBadge({ visits }: { visits: number }) {
  return <span className="text-sm text-muted-foreground">{recurringLabel(visits)}</span>;
}

export function ExcludedBadge() {
  return <span className="text-sm text-muted-foreground">Hidden from reports</span>;
}
