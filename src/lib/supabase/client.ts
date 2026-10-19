import { createBrowserClient } from "@supabase/ssr";

// Supabase client for Client Components (runs in the browser).
// Only uses the public URL and publishable key; row-level security
// in the database decides what each user can see.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
