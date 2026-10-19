"use client";

import { AlertCircle, Check, ChevronLeft, ChevronRight, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SaveStatus } from "./use-autosave";

const STATUS_TEXT: Record<SaveStatus, string> = {
  saved: "Saved",
  unsaved: "Save",
  saving: "Saving...",
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
              "flex h-12 items-center justify-center gap-1.5 justify-self-center rounded-lg px-3 text-sm",
              status === "saved" && "text-muted-foreground",
              status === "unsaved" && "font-medium",
              (status === "error" || status === "incomplete") && "font-medium text-destructive",
            )}
          >
            {status === "saved" && <Check className="size-4" />}
            {status === "unsaved" && <Save className="size-4" />}
            {status === "saving" && <Loader2 className="size-4 animate-spin" />}
            {(status === "error" || status === "incomplete") && <AlertCircle className="size-4" />}
            {STATUS_TEXT[status]}
          </button>
        ) : (
          <span className="justify-self-center text-sm text-muted-foreground">Read-only</span>
        )}

        {onSubmit ? (
          <Button type="button" onClick={onSubmit} className="h-12 justify-self-end px-5 text-base">
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
