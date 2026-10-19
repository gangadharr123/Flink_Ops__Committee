import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getHubs, listVisits, type VisitListItem } from "@/lib/visits";

export const metadata: Metadata = { title: "Visits" };

export default function VisitsPage({ searchParams }: PageProps<"/visits">) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">Visits</h1>
      {/* The list reads the URL (?hub=) and the session, so it streams in. */}
      <Suspense fallback={<ListSkeleton />}>
        <VisitList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function VisitList({
  searchParams,
}: {
  searchParams: PageProps<"/visits">["searchParams"];
}) {
  const { hub } = await searchParams;
  const [user, hubs] = await Promise.all([getCurrentUser(), getHubs()]);
  const selectedHub = hubs.find((h) => h.name === hub)?.name;
  const visits = await listVisits(selectedHub);
  const canCreate = user.role === "inspector" || user.role === "admin";

  return (
    <>
      <nav aria-label="Filter by hub" className="flex flex-wrap gap-2">
        <FilterChip href="/visits" active={!selectedHub}>
          All hubs
        </FilterChip>
        {hubs.map((h) => (
          <FilterChip
            key={h.id}
            href={`/visits?hub=${encodeURIComponent(h.name)}`}
            active={selectedHub === h.name}
          >
            {h.name}
          </FilterChip>
        ))}
      </nav>

      {visits.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
          No visits yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visits.map((visit) => (
            <VisitRow key={visit.id} visit={visit} />
          ))}
        </ul>
      )}

      {canCreate && (
        // On phones this sits above the tab bar, within thumb reach.
        <div className="sticky bottom-20 mt-2 md:static">
          <Link
            href="/visits/new"
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-12 w-full text-base shadow-md md:w-auto md:shadow-none",
            )}
          >
            <Plus /> New visit
          </Link>
        </div>
      )}
    </>
  );
}

function VisitRow({ visit }: { visit: VisitListItem }) {
  const isDraft = visit.status === "draft";
  return (
    <li>
      <Link
        href={`/visits/${visit.id}`}
        className="flex min-h-16 items-center justify-between gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted"
      >
        <div className="min-w-0">
          <p className="truncate font-medium">
            {visit.hub.name} · {visit.label ?? `Visit ${visit.visit_number}`}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {formatDate(visit.visit_date)}
            {visit.date_is_placeholder && " (date not confirmed)"}
            {visit.inspector?.full_name && ` · ${visit.inspector.full_name}`}
          </p>
        </div>
        <Badge
          variant={isDraft ? "outline" : "secondary"}
          className={cn(isDraft && "border-amber-500 text-amber-700 dark:text-amber-400")}
        >
          {isDraft ? "Draft" : "Submitted"}
        </Badge>
      </Link>
    </li>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-background hover:bg-muted",
      )}
    >
      {children}
    </Link>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <div className="h-10 w-48 animate-pulse rounded-full bg-muted" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}
