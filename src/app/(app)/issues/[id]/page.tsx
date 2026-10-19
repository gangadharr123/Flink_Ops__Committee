import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { RecurringBadge, SeverityBadge } from "@/components/issues/issue-badges";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { CATEGORY_LABELS, UPDATE_STATES } from "@/lib/issues";
import { getIssueDetail, type TimelineEntry } from "@/lib/issues-data";
import { cn } from "@/lib/utils";
import { ExcludeToggle } from "./exclude-toggle";

export const metadata: Metadata = { title: "Issue" };

export default function IssuePage({ params }: PageProps<"/issues/[id]">) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Link
        href="/issues"
        className="-ml-2 inline-flex h-11 items-center gap-1 self-start rounded-lg px-2 text-sm text-muted-foreground hover:bg-muted"
      >
        <ChevronLeft className="size-4" /> Issues
      </Link>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <IssueDetail params={params} />
      </Suspense>
    </div>
  );
}

async function IssueDetail({ params }: { params: PageProps<"/issues/[id]">["params"] }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [user, issue] = await Promise.all([getCurrentUser(), getIssueDetail(id)]);
  if (!issue) notFound();
  const canEdit = user.role === "inspector" || user.role === "admin";

  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold leading-tight">{issue.title}</h1>
        <p className="text-sm text-muted-foreground">
          {issue.hubName} · {CATEGORY_LABELS[issue.category]} · {issue.key}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <SeverityBadge severity={issue.severity} />
          <Badge variant={issue.status === "open" ? "outline" : "secondary"}>
            {issue.status === "open" ? "Open" : "Resolved"}
          </Badge>
          {issue.isRecurring && <RecurringBadge visits={issue.visitsSeen} />}
        </div>
        {issue.description && (
          <p className="mt-1 whitespace-pre-line">{issue.description}</p>
        )}
      </header>

      <dl className="grid grid-cols-3 gap-3 rounded-xl border p-4 text-sm">
        <div>
          <dt className="text-muted-foreground">Days open</dt>
          <dd className="text-lg font-semibold">{issue.daysOpen ?? "-"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Visits seen</dt>
          <dd className="text-lg font-semibold">{issue.visitsSeen}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Recurring</dt>
          <dd className="text-lg font-semibold">{issue.isRecurring ? "Yes" : "No"}</dd>
        </div>
        <p className="col-span-3 text-xs text-muted-foreground">
          {issue.firstSeen && `First seen ${formatDate(issue.firstSeen)}`}
          {issue.resolvedDate && ` · resolved ${formatDate(issue.resolvedDate)}`}
        </p>
      </dl>

      <ExcludeToggle issueId={issue.id} initial={issue.excluded} disabled={!canEdit} />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Timeline</h2>
        <ol className="relative flex flex-col gap-4 border-l pl-5">
          {issue.timeline.map((entry) => (
            <TimelineItem key={entry.visitId} entry={entry} />
          ))}
        </ol>
      </section>
    </>
  );
}

const STATE_DOT: Record<TimelineEntry["state"], string> = {
  new: "bg-red-600",
  still_open: "bg-amber-600",
  improved: "bg-sky-600",
  resolved: "bg-emerald-600",
};

function TimelineItem({ entry }: { entry: TimelineEntry }) {
  return (
    <li className="relative">
      <span
        aria-hidden
        className={cn(
          "absolute top-1.5 -left-[1.6rem] size-3 rounded-full ring-4 ring-background",
          STATE_DOT[entry.state],
        )}
      />
      <Link href={`/visits/${entry.visitId}`} className="font-medium hover:underline">
        {entry.visitLabel} · {formatDate(entry.visitDate)}
      </Link>
      {entry.visitStatus === "draft" && (
        <Badge variant="outline" className="ml-2">
          Draft
        </Badge>
      )}
      <p className="text-sm font-medium">
        {UPDATE_STATES.find((s) => s.value === entry.state)?.label}
      </p>
      {entry.note && <p className="text-sm text-muted-foreground">{entry.note}</p>}
      {entry.photos.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {entry.photos.map((photo) =>
            photo.url ? (
              <li key={photo.id}>
                <a href={photo.url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element -- signed URLs change every load */}
                  <img
                    src={photo.url}
                    alt={photo.caption ?? "Issue photo"}
                    className="size-24 rounded-lg border object-cover"
                  />
                </a>
              </li>
            ) : null,
          )}
        </ul>
      )}
    </li>
  );
}
