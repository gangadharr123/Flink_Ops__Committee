import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/app-shell/placeholder-page";

export const metadata: Metadata = { title: "Visits" };

export default function VisitsPage() {
  return (
    <PlaceholderPage
      title="Visits"
      description="Hub visits will be listed and logged here."
    />
  );
}
