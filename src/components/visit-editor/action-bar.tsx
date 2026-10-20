"use client";

import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Loader2,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnline } from "@/lib/use-online";
import { cn } from "@/lib/utils";
import type { SaveStatus } from "./use-autosave";

const STATUS_TEXT: Record<SaveStatus, string> = {
  saved: "Synced",
  unsaved: "Save",
  saving: "Syncing...",
  local: "Saved on this phone",
  error: "Not saved",
  incomplete: "Check fields",
};

// Sticky bar at the bottom: Back · save status · Next (or Submit).
// On phones it replaces the tab bar so everything is within thumb reach.
export function ActionBar({
  status,
  error,
  onSave,
  onBack,
  onNext,
  onSubmit,
}: {
  status: SaveStatus | null; // null = read-only
  error: string | null;
  onSave: () => void;
  onBack?: () => void;
  onNext?: () => void;
  onSubmit?: () => void;
}) {
  const online = useOnline();
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:left-60">
      {status === "error" && error && (
        <p className="border-b bg-destructive/10 px-4 py-1.5 text-center text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="mx-auto grid h-16 max-w-5xl grid-cols-3 items-center gap-2 px-4">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={!onBack}
          className="h-12 justify-self-start px-4 text-base"
        >
          <ChevronLeft /> Back
        </Button>

        {status ? (
          <button
            type="button"
            onClick={onSave}
            aria-live="polite"
            className={cn(
              "flex h-12 items-center justify-center gap-1.5 justify-self-center rounded-lg px-2 text-center text-sm leading-tight",
              status === "saved" && "text-muted-foreground",
              status === "unsaved" && "font-medium",
              status === "local" && "font-medium text-amber-700 dark:text-amber-400",
              (status === "error" || status === "incomplete") && "font-medium text-destructive",
            )}
          >
            {status === "saved" && <Check className="size-4" />}
            {status === "unsaved" && <Save className="size-4" />}
            {status === "saving" && <Loader2 className="size-4 animate-spin" />}
            {status === "local" && <CloudOff className="size-4" />}
            {(status === "error" || status === "incomplete") && <AlertCircle className="size-4" />}
            {STATUS_TEXT[status]}
          </button>
        ) : (
          <span className="justify-self-center text-sm text-muted-foreground">Read-only</span>
        )}

        {onSubmit ? (
          <Button
            type="button"
            onClick={onSubmit}
            disabled={!online}
            title={online ? undefined : "Needs a connection"}
            className="h-12 justify-self-end px-5 text-base"
          >
            Submit
          </Button>
        ) : (
          <Button
            type="button"
            onClick={onNext}
            disabled={!onNext}
            className="h-12 justify-self-end px-4 text-base"
          >
            Next <ChevronRight />
          </Button>
        )}
      </div>
    </div>
  );
}
