"use client";

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

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

// Same links, two layouts: a vertical list in the laptop sidebar and
// a row of icon tabs in the phone bottom bar.
export function NavLinks({ variant }: { variant: "sidebar" | "bottom" }) {
  const pathname = usePathname();

  return (
    <ul
      className={cn(
        variant === "sidebar" ? "flex flex-col gap-1" : "grid grid-cols-4",
      )}
    >
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "transition-colors",
                variant === "sidebar"
                  ? "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium"
                  : "flex h-16 flex-col items-center justify-center gap-1 text-xs",
                active
                  ? variant === "sidebar"
                    ? "bg-muted text-foreground"
                    : "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
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
