import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { loadAirtableAnswers } from "@/lib/airtable/load";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { AnswerBoxes } from "./answer-boxes";

export const metadata: Metadata = { title: "Airtable answers" };

export default function AirtablePage({ params }: PageProps<"/visits/[id]/airtable">) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Answers params={params} />
      </Suspense>
    </div>
  );
}

async function Answers({ params }: { params: PageProps<"/visits/[id]/airtable">["params"] }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [user, data] = await Promise.all([getCurrentUser(), loadAirtableAnswers(id)]);
  if (!data) notFound();
  const canEdit = user.role === "inspector" || user.role === "admin";

  return (
    <>
      <Link
        href={`/visits/${id}`}
        className="-ml-2 inline-flex h-11 items-center gap-1 self-start rounded-lg px-2 text-sm text-muted-foreground hover:bg-muted"
      >
        <ChevronLeft className="size-4" /> Back to visit
      </Link>
      <header>
        <h1 className="text-2xl font-semibold">Airtable answers</h1>
        <p className="text-muted-foreground">
          {data.visit.hubName} · {data.visit.label} · {formatDate(data.visit.visitDate)}
        </p>
      </header>
      {data.visit.status === "draft" && (
        <p className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
          This visit is still a draft. The answers will change as you finish it.
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        Each answer is written from the visit data. Edit it if needed (edits are saved), then tap
        Copy and paste it into the Airtable form.
      </p>
      <AnswerBoxes
        visitId={id}
        generated={data.generated}
        edited={data.edited}
        canEdit={canEdit}
      />
    </>
  );
}
