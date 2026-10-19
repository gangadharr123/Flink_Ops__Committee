import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  ExcludedBadge,
  RecurringBadge,
  SeverityBadge,
} from "@/components/issues/issue-badges";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABELS, SEVERITIES } from "@/lib/issues";
import { listIssues, type IssueFilters, type IssueListItem } from "@/lib/issues-data";
import { cn } from "@/lib/utils";
import { getHubs } from "@/lib/visits";

export const metadata: Metadata = { title: "Issues" };

type Search = Awaited<PageProps<"/issues">["searchParams"]>;

export default function IssuesPage({ searchParams }: PageProps<"/issues">) {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">Issues</h1>
      {/* Filters come from the URL and the list needs the session: stream both. */}
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
        <IssueList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "all", label: "All" },
] as const;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function IssueList({ searchParams }: { searchParams: PageProps<"/issues">["searchParams"] }) {
  const params = await searchParams;
  const hubs = await getHubs();

  const hub = hubs.find((h) => h.name === one(params.hub))?.name;
  const severity = SEVERITIES.find((s) => s.value === one(params.severity))?.value;
  // Open issues by default; ?status=all shows everything.
  const statusParam = one(params.status);
  const status = statusParam === "resolved" || statusParam === "all" ? statusParam : "open";

  const filters: IssueFilters = {
    hub,
    severity,
    status: status === "all" ? undefined : status,
  };
  const issues = await listIssues(filters);

  return (
    <>
      <div className="flex flex-col gap-2">
        <FilterRow label="Hub">
          <Chip params={params} name="hub" value={undefined} active={!hub}>
            All
          </Chip>
          {hubs.map((h) => (
            <Chip key={h.id} params={params} name="hub" value={h.name} active={hub === h.name}>
              {h.name}
            </Chip>
          ))}
        </FilterRow>
        <FilterRow label="Severity">
          <Chip params={params} name="severity" value={undefined} active={!severity}>
            All
          </Chip>
          {SEVERITIES.map((s) => (
            <Chip
              key={s.value}
              params={params}
              name="severity"
              value={s.value}
              active={severity === s.value}
            >
              {s.label}
            </Chip>
          ))}
        </FilterRow>
        <FilterRow label="Status">
          {STATUS_OPTIONS.map((s) => (
            <Chip
              key={s.value}
              params={params}
              name="status"
              value={s.value === "open" ? undefined : s.value}
              active={status === s.value}
            >
              {s.label}
            </Chip>
          ))}
        </FilterRow>
      </div>

      <p className="text-sm text-muted-foreground">
        {issues.length} issue{issues.length === 1 ? "" : "s"}
      </p>

      {issues.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
          No issues match these filters.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {issues.map((issue) => (
            <IssueRow key={issue.id} issue={issue} />
          ))}
        </ul>
      )}
    </>
  );
}

function IssueRow({ issue }: { issue: IssueListItem }) {
  return (
    <li>
      <Link
        href={`/issues/${issue.id}`}
        className="flex flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:bg-muted sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="font-medium leading-snug">{issue.title}</p>
          <p className="text-sm text-muted-foreground">
            {issue.hubName} · {CATEGORY_LABELS[issue.category]}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <SeverityBadge severity={issue.severity} />
            {issue.status === "resolved" && <Badge variant="secondary">Resolved</Badge>}
            {issue.isRecurring && <RecurringBadge visits={issue.visitsSeen} />}
            {issue.excluded && <ExcludedBadge />}
            {issue.fromDraft && <Badge variant="outline">From a draft visit</Badge>}
          </div>
        </div>
        {issue.daysOpen !== null && (
          <p className="shrink-0 text-sm text-muted-foreground sm:text-right">
            {issue.status === "resolved" ? "Was open" : "Open"} {issue.daysOpen}{" "}
            day{issue.daysOpen === 1 ? "" : "s"}
          </p>
        )}
      </Link>
    </li>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
      {/* Scrolls sideways on narrow phones instead of wrapping into many rows. */}
      <div className="-mr-4 flex gap-2 overflow-x-auto pr-4 pb-1 md:mr-0 md:flex-wrap md:pr-0">
        {children}
      </div>
    </div>
  );
}

// A link that changes one filter and keeps the others.
function Chip({
  params,
  name,
  value,
  active,
  children,
}: {
  params: Search;
  name: "hub" | "severity" | "status";
  value: string | undefined;
  active: boolean;
  children: React.ReactNode;
}) {
  const next = new URLSearchParams();
  for (const key of ["hub", "severity", "status"] as const) {
    const current = one(params[key]);
    if (key !== name && current) next.set(key, current);
  }
  if (value) next.set(name, value);
  const query = next.toString();

  return (
    <Link
      href={query ? `/issues?${query}` : "/issues"}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-background hover:bg-muted",
      )}
    >
      {children}
    </Link>
  );
}

