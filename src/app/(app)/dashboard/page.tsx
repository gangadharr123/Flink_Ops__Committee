import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  OpenBySeverityChart,
  ResolvedPerMonthChart,
  ShelfConditionChart,
  TopTopicsChart,
} from "@/components/dashboard/charts";
import { RecurringBadge, SeverityBadge } from "@/components/issues/issue-badges";
import { EmptyState } from "@/components/empty-state";
import { loadDashboard } from "@/lib/dashboard/load";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Submitted visits only. Issues hidden from reports are not counted.
        </p>
      </div>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

async function DashboardContent() {
  const d = await loadDashboard();

  return (
    <>
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Open issues" value={d.kpis.open} />
        <Kpi label="Immediate, open" value={d.kpis.immediateOpen} alert={d.kpis.immediateOpen > 0} />
        <Kpi label="Recurring, open" value={d.kpis.recurringOpen} />
        <Kpi label="Visits this month" value={d.kpis.visitsThisMonth} />
      </dl>

      {/* Laptop: 2 columns. Phone: one column. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Open issues by hub and severity">
          {d.kpis.open === 0 ? (
            <Empty>No open issues.</Empty>
          ) : (
            <>
              <OpenBySeverityChart data={d.openBySeverity} />
              <DataTable
                head={["Hub", "Immediate", "High", "Medium", "Low"]}
                rows={d.openBySeverity.map((r) => [r.hub, r.immediate, r.high, r.medium, r.low])}
              />
            </>
          )}
        </Card>

        <Card title="Oldest open issues">
          {d.oldestOpen.length === 0 ? (
            <Empty>No open issues.</Empty>
          ) : (
            <div className="-mx-4 overflow-x-auto px-4">
              <table className="w-full min-w-[28rem] text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-2 font-normal">Issue</th>
                    <th className="py-2 pr-2 font-normal">Hub</th>
                    <th className="py-2 pr-2 text-right font-normal">Days open</th>
                    <th className="py-2 text-right font-normal">Visits seen</th>
                  </tr>
                </thead>
                <tbody>
                  {d.oldestOpen.map((issue) => (
                    <tr key={issue.id} className="border-t">
                      <td className="py-2 pr-2">
                        <Link href={`/issues/${issue.id}`} className="font-medium hover:underline">
                          {issue.title}
                        </Link>
                        <div className="mt-1 flex flex-wrap gap-x-2 text-muted-foreground">
                          <SeverityBadge severity={issue.severity} />
                          {issue.isRecurring && <RecurringBadge visits={issue.visitsSeen} />}
                        </div>
                      </td>
                      <td className="py-2 pr-2">{issue.hub}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{issue.daysOpen ?? "-"}</td>
                      <td className="py-2 text-right tabular-nums">{issue.visitsSeen}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {d.shelfByVisit.map((hub) => (
          <Card key={hub.hub} title={`Shelf condition per visit: ${hub.hub}`}>
            {hub.visits.length === 0 ? (
              <Empty>No submitted visits yet.</Empty>
            ) : (
              <>
                <ShelfConditionChart visits={hub.visits} />
                <DataTable
                  head={["Visit", "Clean", "Dusty", "Mould"]}
                  rows={hub.visits.map((v) => [v.label, v.clean, v.dusty, v.mould])}
                />
              </>
            )}
          </Card>
        ))}

        <Card title="Top recurring staff topics">
          {d.topTopics.length === 0 ? (
            <Empty>No topic has been raised on more than one visit yet.</Empty>
          ) : (
            <>
              <TopTopicsChart data={d.topTopics} />
              <DataTable
                head={["Topic", "Visits raised on", "Times raised"]}
                rows={d.topTopics.map((t) => [t.topic, t.visits, t.times])}
              />
            </>
          )}
        </Card>

        <Card title="Issues resolved per month">
          <ResolvedPerMonthChart data={d.resolvedPerMonth} hubs={d.hubNames} />
          <DataTable
            head={["Month", ...d.hubNames]}
            rows={d.resolvedPerMonth.map((m) => [m.label, ...d.hubNames.map((h) => m.counts[h])])}
          />
        </Card>
      </div>
    </>
  );
}

function Kpi({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className="rounded-lg border p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={cn("text-xl font-semibold tabular-nums", alert && "text-state-critical")}>
        {value}
      </dd>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-lg border p-4">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <EmptyState className="border-0">{children}</EmptyState>;
}

// The numbers behind a chart, for anyone who can't read the colours.
function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground print:hidden">
        Show as table
      </summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full">
          <thead className="text-left text-muted-foreground">
            <tr>
              {head.map((h, i) => (
                <th key={h} className={cn("py-2 pr-4 font-normal", i > 0 && "text-right")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row[0])} className="border-t">
                {row.map((cell, i) => (
                  <td key={i} className={cn("py-2 pr-4", i > 0 && "text-right tabular-nums")}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-72 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}
