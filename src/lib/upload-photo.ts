// Browser-side upload to the private "visit-photos" bucket.
// Storage rules only accept files inside a draft visit's folder, and only
// from inspectors and admins (see the issues migration).
import { createClient } from "@/lib/supabase/client";
import { uuid } from "@/lib/uuid";

const BUCKET = "visit-photos";

// Uploads a compressed JPEG and returns its path: "<visit id>/<uuid>.jpg".
export async function uploadVisitPhoto(visitId: string, blob: Blob): Promise<string> {
  const path = `${visitId}/${uuid()}.jpg`;
  const { error } = await createClient()
    .storage.from(BUCKET)
    .upload(path, blob, { contentType: "image/jpeg" });
  if (error) {
    throw new Error(
      error.message.includes("row-level security")
        ? "You can't add photos to this visit."
        : "Photo upload failed. Check your connection and try again.",
    );
  }
  return path;
}

// Cleans up a file whose database row could not be created.
export async function removeUploadedPhoto(path: string) {
  await createClient().storage.from(BUCKET).remove([path]);
}
