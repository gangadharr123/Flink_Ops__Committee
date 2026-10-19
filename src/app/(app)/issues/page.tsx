import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/app-shell/placeholder-page";

export const metadata: Metadata = { title: "Issues" };

export default function IssuesPage() {
  return (
    <PlaceholderPage
      title="Issues"
      description="Open and recurring issues across visits will show here."
    />
  );
}
