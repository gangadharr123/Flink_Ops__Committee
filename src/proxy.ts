import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16 calls this "proxy" (it used to be "middleware").
// It runs before every matching request.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Run on everything except static files and images.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
