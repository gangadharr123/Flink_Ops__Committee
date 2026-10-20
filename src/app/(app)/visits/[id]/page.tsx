import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { VisitEditor } from "@/components/visit-editor/visit-editor";
import { getCurrentUser } from "@/lib/auth";
import { getVisitForEditor } from "@/lib/visits";

export const metadata: Metadata = { title: "Visit" };

export default function VisitPage({ params }: PageProps<"/visits/[id]">) {
  return (
    // The visit id (URL) and the session are request data, so the editor
    // streams in behind this boundary.
    <Suspense fallback={<EditorSkeleton />}>
      <VisitLoader params={params} />
    </Suspense>
  );
}

async function VisitLoader({
  params,
}: {
  params: PageProps<"/visits/[id]">["params"];
}) {
  const { id } = await params;
  // Not a uuid: the database would reject it anyway, so 404 early.
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [user, data] = await Promise.all([getCurrentUser(), getVisitForEditor(id)]);
  if (!data) notFound();
  const canEdit = user.role === "inspector" || user.role === "admin";

  // key: after submitting, the editor starts fresh in read-only mode.
  return (
    <VisitEditor
      key={data.visit.status}
      data={data}
      canEdit={canEdit}
      isAdmin={user.role === "admin"}
    />
  );
}

function EditorSkeleton() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="h-12 animate-pulse rounded-lg bg-muted" />
      <div className="h-8 animate-pulse rounded-lg bg-muted" />
      <div className="h-96 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
