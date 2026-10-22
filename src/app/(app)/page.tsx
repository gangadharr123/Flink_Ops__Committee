import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { severityTone, StateLabel } from "@/components/state";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { loadHubOverview } from "@/lib/home/load";
import type { HubOverview } from "@/lib/home/overview";
import { SEVERITIES } from "@/lib/issues";
import { cn } from "@/lib/utils";

// Home: one card per hub. Last visit, open immediate issues, the oldest
// open issue, and whether a visit is due this month.
export default function HomePage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <h1 className="text-xl font-semibold">Hubs</h1>
      <Suspense
        fallback={
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-56 animate-pulse rounded-lg bg-muted" />
            <div className="h-56 animate-pulse rounded-lg bg-muted" />
          </div>
        }
      >
        <Overview />
      </Suspense>
    </div>
  );
}

async function Overview() {
  const [user, hubs] = await Promise.all([getCurrentUser(), loadHubOverview()]);
  const canCreate = user.role === "inspector" || user.role === "admin";

  return (
    <>
      <p className="-mt-4 text-sm text-muted-foreground">
        Signed in as {user.fullName ?? user.email}
        {user.role && <span className="capitalize"> · {user.role}</span>}
        {!user.role && " · no profile yet: run the profiles migration"}
      </p>

      {hubs.length === 0 ? (
        <EmptyState>No hubs yet. Run the hubs and shelves migration in Supabase.</EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {hubs.map((hub) => (
            <HubCard key={hub.hubId} hub={hub} canCreate={canCreate} />
          ))}
        </div>
      )}
    </>
  );
}

function HubCard({ hub, canCreate }: { hub: HubOverview; canCreate: boolean }) {
  const hubQuery = `hub=${encodeURIComponent(hub.hub)}`;
  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold">{hub.hub}</h2>
        <StateLabel tone={hub.visitedThisMonth ? "neutral" : "warning"} className="text-sm">
          {hub.visitedThisMonth ? "Visited this month" : "Visit due this month"}
        </StateLabel>
      </header>

      <dl className="flex flex-col gap-4">
        <Row label="Last visit">
          {hub.lastVisit ? (
            <Link href={`/visits/${hub.lastVisit.id}`} className="hover:underline">
              {hub.lastVisit.label} · {formatDate(hub.lastVisit.date)} ·{" "}
              {daysAgo(hub.lastVisit.daysSince)}
            </Link>
          ) : (
            <span className="text-muted-foreground">No visits yet</span>
          )}
        </Row>

        <Row label="Open immediate issues">
          <Link
            href={`/issues?${hubQuery}&severity=immediate`}
            className={cn(
              "font-semibold hover:underline",
              hub.openImmediate > 0 && "text-state-critical",
            )}
          >
            {hub.openImmediate}
          </Link>
        </Row>

        <Row label="Oldest open issue">
          {hub.oldestOpen ? (
            <Link href={`/issues/${hub.oldestOpen.id}`} className="flex flex-col hover:underline">
              <span>{hub.oldestOpen.title}</span>
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <StateLabel tone={severityTone(hub.oldestOpen.severity)}>
                  {SEVERITIES.find((s) => s.value === hub.oldestOpen!.severity)?.label}
                </StateLabel>
                {hub.oldestOpen.daysOpen !== null && <span>· open {days(hub.oldestOpen.daysOpen)}</span>}
              </span>
            </Link>
          ) : (
            <span className="text-muted-foreground">No open issues</span>
          )}
        </Row>
      </dl>

      {hub.draft ? (
        <Link
          href={`/visits/${hub.draft.id}`}
          className={cn(buttonVariants({ variant: "outline" }), "h-12 text-base")}
        >
          Continue {hub.draft.label}
        </Link>
      ) : (
        canCreate && (
          <Link
            href="/visits/new"
            className={cn(buttonVariants({ variant: "outline" }), "h-12 text-base")}
          >
            New visit
          </Link>
        )
      )}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;
const daysAgo = (n: number) => (n === 0 ? "today" : `${days(n)} ago`);
