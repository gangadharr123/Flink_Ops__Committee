"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createVisit, type ActionState } from "../actions";

export function NewVisitForm({
  hubs,
  today,
}: {
  hubs: { id: string; name: string }[];
  today: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createVisit,
    {},
  );
  const [hubId, setHubId] = useState<string | null>(null);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Hub</legend>
        <div className="grid grid-cols-2 gap-4">
          {hubs.map((hub) => (
            <button
              key={hub.id}
              type="button"
              aria-pressed={hubId === hub.id}
              onClick={() => setHubId(hub.id)}
              className={cn(
                "h-16 rounded-lg border text-base transition-colors",
                hubId === hub.id
                  ? "border-foreground font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {hub.name}
            </button>
          ))}
        </div>
        <input type="hidden" name="hubId" value={hubId ?? ""} />
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="visitDate">Date</Label>
        <Input
          id="visitDate"
          name="visitDate"
          type="date"
          defaultValue={today}
          required
          className="h-12 text-base"
        />
      </div>

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={!hubId || pending}
        className="h-12 text-base"
      >
        {pending ? "Creating..." : "Start visit"}
      </Button>
      <p className="text-sm text-muted-foreground">
        The visit number is set automatically. Shelf conditions are copied
        from the hub&apos;s last submitted visit.
      </p>
    </form>
  );
}
