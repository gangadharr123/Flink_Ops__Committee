"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  House,
  LayoutDashboard,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: House },
  { href: "/visits", label: "Visits", icon: ClipboardList },
  { href: "/issues", label: "Issues", icon: TriangleAlert },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

type Variant = "sidebar" | "bottom";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

// The visit editor (/visits/<id>) has its own Back / Next bar at the bottom,
// so the phone tab bar steps aside there. /visits/new keeps it.
export function isVisitEditor(pathname: string) {
  return /^\/visits\/(?!new$)[^/]+$/.test(pathname);
}

// usePathname() is only known at request time on dynamic routes, so with
// Cache Components it must sit inside <Suspense>. The fallback is the same
// list without a highlighted item; the highlight fills in immediately.
export function NavLinks({ variant }: { variant: Variant }) {
  return (
    <Suspense fallback={<LinkList variant={variant} pathname={null} />}>
      <ActiveNavLinks variant={variant} />
    </Suspense>
  );
}

function ActiveNavLinks({ variant }: { variant: Variant }) {
  return <LinkList variant={variant} pathname={usePathname()} />;
}

// The phone bottom bar: hidden inside the visit editor.
export function BottomNav() {
  return (
    <Suspense fallback={<BottomBar pathname={null} />}>
      <ActiveBottomNav />
    </Suspense>
  );
}

function ActiveBottomNav() {
  return <BottomBar pathname={usePathname()} />;
}

function BottomBar({ pathname }: { pathname: string | null }) {
  if (pathname && isVisitEditor(pathname)) return null;
  return (
    <nav
      aria-label="Main"
      // Bottom padding: iPhone home indicator + room for the Netlify badge.
      className="fixed inset-x-0 bottom-0 z-10 border-t bg-background pb-[calc(env(safe-area-inset-bottom)+var(--badge-clearance))] md:hidden print:hidden"
    >
      <LinkList variant="bottom" pathname={pathname} />
    </nav>
  );
}

// Same links, two layouts: a vertical list in the laptop sidebar and
// a row of icon tabs in the phone bottom bar.
function LinkList({
  variant,
  pathname,
}: {
  variant: Variant;
  pathname: string | null;
}) {
  return (
    <ul
      className={cn(
        variant === "sidebar" ? "flex flex-col gap-2" : "grid grid-cols-4",
      )}
    >
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname !== null && isActive(pathname, href);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "transition-colors",
                variant === "sidebar"
                  ? "flex min-h-10 items-center gap-2 border-l-2 px-4 text-sm"
                  : "flex h-16 flex-col items-center justify-center gap-1 text-sm",
                // Active: a thin line on the left (sidebar) or bold label (tab bar).
                active
                  ? cn("font-medium text-foreground", variant === "sidebar" && "border-foreground")
                  : cn(
                      "text-muted-foreground hover:text-foreground",
                      variant === "sidebar" && "border-transparent",
                    ),
              )}
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
