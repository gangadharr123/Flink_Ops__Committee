import { cn } from "@/lib/utils";

// Filter chips (visits, issues, shelves): thin border; the active one has a
// dark border and bold text, no colour fill.
export function chipClass(active: boolean, className?: string) {
  return cn(
    "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm whitespace-nowrap transition-colors",
    active
      ? "border-foreground font-medium text-foreground"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
    className,
  );
}
