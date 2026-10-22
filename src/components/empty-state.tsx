import { cn } from "@/lib/utils";

// Shown when a list or section has nothing yet: one sentence, and the next
// step if there is one.
export function EmptyState({
  children,
  action,
  className,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 rounded-lg border border-dashed px-4 py-8 text-center",
        className,
      )}
    >
      <p className="text-muted-foreground">{children}</p>
      {action}
    </div>
  );
}
