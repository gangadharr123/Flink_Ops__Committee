"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendMagicLink, type LoginState } from "./actions";

const initialState: LoginState = { status: "idle" };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(
    sendMagicLink,
    initialState,
  );
  // /auth/confirm sends people back here with ?error=link if a link failed.
  const linkError = useSearchParams().get("error") === "link";

  if (state.status === "sent") {
    return (
      <p className="rounded-lg border p-4 text-sm" role="status">
        {state.message} Open it on this device to log in.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {linkError && state.status === "idle" && (
        <p className="text-sm text-destructive" role="alert">
          That login link is invalid or has expired. Request a new one.
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          className="h-11 text-base"
        />
      </div>
      {state.status === "error" && (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending} className="h-11 text-base">
        {pending ? "Sending..." : "Send login link"}
      </Button>
    </form>
  );
}
