import type { Metadata } from "next";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { todayInGermany } from "@/lib/format";
import { getHubs } from "@/lib/visits";
import { NewVisitForm } from "./new-visit-form";

export const metadata: Metadata = { title: "New visit" };

export default function NewVisitPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <h1 className="text-2xl font-semibold">New visit</h1>
      <Suspense
        fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}
      >
        <NewVisit />
      </Suspense>
    </div>
  );
}

async function NewVisit() {
  const [user, hubs] = await Promise.all([getCurrentUser(), getHubs()]);
  if (user.role !== "inspector" && user.role !== "admin") {
    return (
      <p className="text-muted-foreground">
        Only inspectors and admins can create visits.
      </p>
    );
  }
  // Computed after the session read, so it is today at request time.
  return <NewVisitForm hubs={hubs} today={todayInGermany()} />;
}
