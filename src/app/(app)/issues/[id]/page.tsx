import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { RecurringBadge, SeverityBadge } from "@/components/issues/issue-badges";
import { PhotoThumbs } from "@/components/photos/photo-thumbs";
import { openTone, StateDot, StateLabel, type Tone } from "@/components/state";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { CATEGORY_LABELS, UPDATE_STATES, type Severity } from "@/lib/issues";
import { getIssueDetail, type TimelineEntry } from "@/lib/issues-data";
import { ExcludeToggle } from "./exclude-toggle";

export const metadata: Metadata = { title: "Issue" };

export default function IssuePage({ params }: PageProps<"/issues/[id]">) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Link
        href="/issues"
        className="-ml-2 inline-flex h-11 items-center gap-1 self-start rounded-lg px-2 text-sm text-muted-foreground hover:bg-muted print:hidden"
      >
        <ChevronLeft className="size-4" /> Issues
      </Link>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-muted" />}>
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
        <h1 className="text-xl font-semibold leading-tight">{issue.title}</h1>
        <p className="text-sm text-muted-foreground">
          {issue.hubName} · {CATEGORY_LABELS[issue.category]} · {issue.key}
        </p>
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          <SeverityBadge severity={issue.severity} />
          <span>·</span>
          <StateLabel tone={openTone(issue.status === "open")}>
            {issue.status === "open" ? "Open" : "Resolved"}
          </StateLabel>
          {issue.isRecurring && (
            <span>
              · <RecurringBadge visits={issue.visitsSeen} />
            </span>
          )}
        </p>
        {issue.description && <p className="whitespace-pre-line">{issue.description}</p>}
      </header>

      <dl className="grid grid-cols-3 gap-4 rounded-lg border p-4">
        <div>
          <dt className="text-sm text-muted-foreground">Days open</dt>
          <dd className="font-semibold">{issue.daysOpen ?? "-"}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Visits seen</dt>
          <dd className="font-semibold">{issue.visitsSeen}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Recurring</dt>
          <dd className="font-semibold">{issue.isRecurring ? "Yes" : "No"}</dd>
        </div>
        <p className="col-span-3 text-sm text-muted-foreground">
          {issue.firstSeen && `First seen ${formatDate(issue.firstSeen)}`}
          {issue.resolvedDate && ` · resolved ${formatDate(issue.resolvedDate)}`}
        </p>
      </dl>

      <ExcludeToggle issueId={issue.id} initial={issue.excluded} disabled={!canEdit} />

      <section className="flex flex-col gap-4">
        <h2 className="font-semibold">Timeline</h2>
        <ol className="relative flex flex-col gap-6 border-l pl-6">
          {issue.timeline.map((entry) => (
            <TimelineItem key={entry.visitId} entry={entry} severity={issue.severity} />
          ))}
        </ol>
      </section>
    </>
  );
}

// Dot: grey once resolved; while open, red for immediate issues, else amber.
function TimelineItem({ entry, severity }: { entry: TimelineEntry; severity: Severity }) {
  const tone: Tone =
    entry.state === "resolved" ? "neutral" : severity === "immediate" ? "critical" : "warning";
  return (
    <li className="relative">
      <StateDot
        tone={tone}
        className="absolute top-2 -left-[1.75rem] size-2.5 outline-4 outline-background"
      />
      <Link href={`/visits/${entry.visitId}`} className="font-medium hover:underline">
        {entry.visitLabel} · {formatDate(entry.visitDate)}
      </Link>
      {entry.visitStatus === "draft" && (
        <span className="text-sm text-muted-foreground"> · draft</span>
      )}
      <p className="text-sm">
        {UPDATE_STATES.find((s) => s.value === entry.state)?.label}
      </p>
      {entry.note && <p className="text-sm text-muted-foreground">{entry.note}</p>}
      {entry.photos.length > 0 && (
        <div className="mt-2">
          <PhotoThumbs photos={entry.photos} alt={`Photo from ${entry.visitLabel}`} size="lg" />
        </div>
      )}
    </li>
  );
}
