"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  status: "idle" | "sent" | "error";
  message?: string;
};

const schema = z.object({
  email: z.email("Enter a valid email address"),
});

export async function sendMagicLink(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = schema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0].message };
  }

  // Build the link back to this site (localhost in dev, Netlify in prod).
  const origin = (await headers()).get("origin");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      // Invite-only: only users you add in the Supabase dashboard can log in.
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });

  // Same message whether or not the email exists, so the form can't be used
  // to find out who has an account. Rate limits are worth showing though.
  if (error && error.status === 429) {
    return {
      status: "error",
      message: "Too many attempts. Wait a minute and try again.",
    };
  }
  if (error) {
    console.error("signInWithOtp failed:", error.message);
  }

  return {
    status: "sent",
    message: "If this email has access, a login link is on its way.",
  };
}
