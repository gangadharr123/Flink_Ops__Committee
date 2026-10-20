"use client";

import { useState, useTransition } from "react";
import { addIssuePhoto, deletePhoto } from "@/app/(app)/visits/actions";
import { PhotoPicker } from "@/components/photos/photo-picker";
import { PhotoThumbs, type Thumb } from "@/components/photos/photo-thumbs";
import { removeUploadedPhoto, uploadVisitPhoto } from "@/lib/upload-photo";

// Photos of one issue taken on this visit: thumbnails, plus add / delete
// while the visit is a draft. Saved immediately (not autosaved).
export function IssuePhotos({
  visitId,
  issueId,
  initial,
  alt,
  readOnly,
}: {
  visitId: string;
  issueId: string;
  initial: Thumb[];
  alt: string;
  readOnly: boolean;
}) {
  const [photos, setPhotos] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function add({ blob, preview }: { blob: Blob; preview: string }) {
    setError(null);
    // 1. upload the file, 2. link it to the issue. Undo 1 if 2 fails.
    const path = await uploadVisitPhoto(visitId, blob);
    const result = await addIssuePhoto(visitId, issueId, path);
    if (result.error || !result.photoId) {
      await removeUploadedPhoto(path).catch(() => {});
      throw new Error(result.error ?? "Could not attach the photo.");
    }
    // Show the local copy now; the next page load uses a signed link.
    setPhotos((list) => [...list, { id: result.photoId!, url: preview, caption: null }]);
  }

  function remove(photoId: string) {
    setError(null);
    startTransition(async () => {
      const result = await deletePhoto(visitId, photoId);
      if (result.error) setError(result.error);
      else setPhotos((list) => list.filter((p) => p.id !== photoId));
    });
  }

  if (readOnly && photos.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <PhotoThumbs photos={photos} alt={alt} onDelete={readOnly ? undefined : remove} />
      {!readOnly && (
        <PhotoPicker onPicked={add} label={photos.length ? "Add another photo" : "Add photo"} />
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
