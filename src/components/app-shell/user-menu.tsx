import { LogOut } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";

// Shows who is logged in plus a sign-out button. Because it calls
// getCurrentUser(), it also acts as a guard: no session means redirect.
export async function UserMenu({ compact = false }: { compact?: boolean }) {
  const user = await getCurrentUser();
  const name = user.fullName ?? user.email ?? "Unknown user";

  return (
    <div className="flex min-w-0 items-center gap-2">
      {!compact && (
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="text-sm capitalize text-muted-foreground">
            {user.role ?? "no role"}
          </p>
        </div>
      )}
      <form action={signOut}>
        <Button
          type="submit"
          variant="ghost"
          size={compact ? "icon" : "default"}
          aria-label="Sign out"
        >
          <LogOut />
          {!compact && "Sign out"}
        </Button>
      </form>
    </div>
  );
}

export function UserMenuSkeleton() {
  return <div className="h-9 w-full animate-pulse rounded-lg bg-muted" />;
}
