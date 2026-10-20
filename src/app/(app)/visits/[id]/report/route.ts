import type { NextRequest } from "next/server";
import { loadReportData } from "@/lib/report/load";
import { buildReport } from "@/lib/report/model";
import { renderReportDocx } from "@/lib/report/render-docx";

// GET /visits/<id>/report -> the visit report as a Word file.
// Runs on the server as the logged-in user (the proxy requires a login and
// row-level security decides which visits they can read).
export async function GET(_request: NextRequest, ctx: RouteContext<"/visits/[id]/report">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });

  const data = await loadReportData(id);
  if (data.status !== "ok") {
    return data.status === "not-found"
      ? new Response("Not found", { status: 404 })
      : new Response("Reports are available once the visit is submitted.", { status: 409 });
  }

  const report = buildReport(data.input);
  const file = await renderReportDocx(report, data.images);

  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${report.fileName}"`,
      // Personal data: never cache in shared caches.
      "Cache-Control": "private, no-store",
    },
  });
}
