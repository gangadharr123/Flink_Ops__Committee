"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type Thumb = { id: string; url: string | null; caption: string | null };

// Small square thumbnails; tap one to open the full photo in a new tab.
// URLs are signed links from the private bucket (valid for 1 hour), so
// plain <img> is used: next/image would cache links that soon expire.
export function PhotoThumbs({
  photos,
  alt,
  onDelete,
  size = "md",
}: {
  photos: Thumb[];
  alt: string;
  onDelete?: (photoId: string) => void;
  size?: "md" | "lg";
}) {
  const shown = photos.filter((p) => p.url);
  if (shown.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {shown.map((photo) => (
        <li key={photo.id} className="relative">
          <a href={photo.url!} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element -- signed URLs expire, see above */}
            <img
              src={photo.url!}
              alt={photo.caption ?? alt}
              loading="lazy"
              className={cn(
                "rounded-lg border object-cover",
                size === "lg" ? "size-24" : "size-20",
              )}
            />
          </a>
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(photo.id)}
              aria-label="Delete photo"
              className="absolute -top-2 -right-2 flex size-8 items-center justify-center rounded-full border bg-background hover:bg-muted print:hidden"
            >
              <X className="size-4" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
