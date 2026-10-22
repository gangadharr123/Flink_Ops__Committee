"use client";

import { useState } from "react";
import { Camera, ImageIcon } from "lucide-react";
import { compressImage } from "@/lib/compress-image";
import { cn } from "@/lib/utils";

// Two ways to add a photo:
//  * "Take photo": capture="environment" opens the rear camera directly on
//    phones (on laptops it is a normal file picker)
//  * "Library": pick a photo taken earlier
// The photo is compressed to about 300 KB before onPicked is called.
export function PhotoPicker({
  onPicked,
  disabled,
  label = "Take photo",
}: {
  onPicked: (photo: { blob: Blob; preview: string }) => void | Promise<void>;
  disabled?: boolean;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const blob = await compressImage(file);
      await onPicked({ blob, preview: URL.createObjectURL(blob) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add the photo.");
    } finally {
      setBusy(false);
    }
  }

  const off = disabled || busy;
  const input = (capture: boolean) => (
    <input
      type="file"
      accept="image/*"
      // "environment" = rear camera
      capture={capture ? "environment" : undefined}
      className="sr-only"
      disabled={off}
      onChange={(e) => {
        void handle(e.target.files?.[0]);
        e.target.value = ""; // allow picking the same photo again
      }}
    />
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <label
          className={cn(
            "flex h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed text-base hover:bg-muted",
            off && "pointer-events-none opacity-60",
          )}
        >
          <Camera className="size-5" />
          {busy ? "Compressing..." : label}
          {input(true)}
        </label>
        <label
          aria-label="Choose from library"
          className={cn(
            "flex h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-4 text-sm hover:bg-muted",
            off && "pointer-events-none opacity-60",
          )}
        >
          <ImageIcon className="size-5" />
          <span className="hidden sm:inline">Library</span>
          {input(false)}
        </label>
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
