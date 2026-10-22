import type { Metadata } from "next";
import { RetryButton } from "./retry-button";

export const metadata: Metadata = { title: "Offline" };

// Shown by the service worker when there is no connection and the page
// you asked for was never opened on this device. Fully static, no login.
export default function OfflinePage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">You&apos;re offline</h1>
      <p className="max-w-sm text-muted-foreground">
        This page hasn&apos;t been opened on this device yet, so it isn&apos;t available without a
        connection. Pages you opened before still work, and any visit edits are kept on this phone
        until you&apos;re back online.
      </p>
      <RetryButton />
    </main>
  );
}
