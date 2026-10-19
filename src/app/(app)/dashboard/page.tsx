import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/app-shell/placeholder-page";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <PlaceholderPage
      title="Dashboard"
      description="Charts and trends for Darmstadt and Mainz will live here."
    />
  );
}
