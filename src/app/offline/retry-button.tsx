"use client";

import { Button } from "@/components/ui/button";

export function RetryButton() {
  return (
    <Button type="button" onClick={() => window.history.back()} className="h-12 px-6 text-base">
      Go back
    </Button>
  );
}
