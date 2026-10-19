import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "inspector" | "viewer" | "admin";

export type CurrentUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  role: Role | null;
};

// The one place that answers "who is logged in?".
// Redirects to /login if nobody is. React's cache() means several
// components can call it during one request and it only runs once.
// It reads cookies, so call it from inside a <Suspense> boundary.
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) {
    redirect("/login");
  }

  // Row-level security only lets a user read their own profile (admins: all).
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", claims.sub)
    .maybeSingle();

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    fullName: profile?.full_name ?? null,
    role: (profile?.role as Role | undefined) ?? null,
  };
});
