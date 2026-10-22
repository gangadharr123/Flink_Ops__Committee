import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FileDown, Plus } from "lucide-react";
import { chipClass } from "@/components/chip-style";
import { EmptyState } from "@/components/empty-state";
import { openTone, StateLabel } from "@/components/state";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getHubs, listVisits, type VisitListItem } from "@/lib/visits";

export const metadata: Metadata = { title: "Visits" };

export default function VisitsPage({ searchParams }: PageProps<"/visits">) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Visits</h1>
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
        <EmptyState>
          {selectedHub ? `No visits at ${selectedHub} yet.` : "No visits yet."}
          {canCreate && " Start one with New visit."}
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {visits.map((visit) => (
            <VisitRow key={visit.id} visit={visit} />
          ))}
        </ul>
      )}

      {canCreate && (
        // On phones this sits above the tab bar, within thumb reach.
        <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom)+var(--badge-clearance))] bg-background pt-2 md:static">
          <Link
            href="/visits/new"
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-12 w-full text-base md:w-auto",
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
    // The download button sits beside the row link: a link can't contain a link.
    <li className="flex items-stretch gap-2">
      <Link
        href={`/visits/${visit.id}`}
        className="flex min-h-16 min-w-0 flex-1 items-center justify-between gap-4 rounded-lg border p-4 transition-colors hover:bg-muted"
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
        <StateLabel tone={openTone(isDraft)} className="text-sm text-muted-foreground">
          {isDraft ? "Draft" : "Submitted"}
        </StateLabel>
      </Link>
      {!isDraft && (
        <a
          href={`/visits/${visit.id}/report`}
          download
          aria-label={`Download report for ${visit.hub.name} ${visit.label ?? `Visit ${visit.visit_number}`}`}
          title="Download report"
          className="flex w-14 shrink-0 items-center justify-center rounded-lg border transition-colors hover:bg-muted"
        >
          <FileDown className="size-5" />
        </a>
      )}
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
      className={chipClass(active)}
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
        <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}
