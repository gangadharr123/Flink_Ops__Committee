import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

// Temporary: replaced by the visit editor in the next step.
export default function VisitPage({ params }: PageProps<"/visits/[id]">) {
  return (
    <Suspense fallback={<div className="h-32 animate-pulse rounded-xl bg-muted" />}>
      <Visit params={params} />
    </Suspense>
  );
}

async function Visit({ params }: { params: PageProps<"/visits/[id]">["params"] }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: visit } = await supabase
    .from("visits")
    .select("label, visit_date, status, hub:hubs (name)")
    .eq("id", id)
    .maybeSingle();
  if (!visit) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold">
        {visit.hub.name} · {visit.label}
      </h1>
      <p className="text-muted-foreground">
        {formatDate(visit.visit_date)} · {visit.status}
      </p>
    </div>
  );
}
