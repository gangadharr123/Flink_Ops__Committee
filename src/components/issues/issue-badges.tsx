import { Repeat } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { recurringLabel, SEVERITIES, type Severity } from "@/lib/issues";
import { cn } from "@/lib/utils";

// Immediate is red and bold, as in the reports.
const SEVERITY_CLASS: Record<Severity, string> = {
  immediate: "border-red-600 bg-red-600 font-bold text-white",
  high: "border-orange-500 bg-orange-500/15 text-orange-800 dark:text-orange-300",
  medium: "border-amber-500 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  low: "border-border text-muted-foreground",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <Badge variant="outline" className={cn(SEVERITY_CLASS[severity])}>
      {SEVERITIES.find((s) => s.value === severity)?.label}
    </Badge>
  );
}

export function RecurringBadge({ visits }: { visits: number }) {
  return (
    <Badge variant="outline" className="border-primary/40 text-foreground">
      <Repeat /> {recurringLabel(visits)}
    </Badge>
  );
}

export function ExcludedBadge() {
  return (
    <Badge variant="outline" className="border-dashed text-muted-foreground">
      Hidden from reports
    </Badge>
  );
}
