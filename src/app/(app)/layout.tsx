import { Suspense } from "react";
import { BottomNav, NavLinks } from "@/components/app-shell/nav-links";
import {
  UserMenu,
  UserMenuSkeleton,
} from "@/components/app-shell/user-menu";

// The logged-in app shell. "(app)" is a route group: it shares this layout
// without adding "/app" to the URL.
// Phones: top bar + bottom tab bar. Laptops (md and up): left sidebar.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh">
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r bg-sidebar p-4 md:flex">
        <p className="mb-6 px-3 text-lg font-semibold">HubCheck</p>
        <nav aria-label="Main" className="flex-1">
          <NavLinks variant="sidebar" />
        </nav>
        <Suspense fallback={<UserMenuSkeleton />}>
          <UserMenu />
        </Suspense>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background px-4 md:hidden">
          <p className="font-semibold">HubCheck</p>
          <Suspense fallback={<div className="size-8" />}>
            <UserMenu compact />
          </Suspense>
        </header>

        {/* Bottom padding keeps content clear of the phone tab bar
            (or the visit editor's Back / Next bar). */}
        <main className="flex-1 p-4 pb-24 md:p-8 md:pb-8">{children}</main>
      </div>

      <BottomNav />
    </div>
  );
}
