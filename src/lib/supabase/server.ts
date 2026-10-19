import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Supabase client for Server Components, Server Actions and Route Handlers.
// It reads the login session from the request cookies. Create a new one per
// request; never share one between users.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components can't set cookies. That's fine: the proxy
            // (src/proxy.ts) refreshes the session on every request.
          }
        },
      },
    },
  );
}
