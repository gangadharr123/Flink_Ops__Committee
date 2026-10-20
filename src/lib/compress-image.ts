// Compresses a phone photo before upload to about 300 KB (JPEG).
// A 4-8 MB camera photo would be slow on hub Wi-Fi and fill the free
// 1 GB of Supabase Storage quickly. Browser only (uses canvas).

export const TARGET_BYTES = 300 * 1024;

// Tried in order until the photo fits: first lower the JPEG quality, then
// make the picture smaller. 1600 px on the long side is plenty for a report.
export const ATTEMPTS: { maxSide: number; quality: number }[] = [
  { maxSide: 1600, quality: 0.82 },
  { maxSide: 1600, quality: 0.7 },
  { maxSide: 1600, quality: 0.6 },
  { maxSide: 1280, quality: 0.7 },
  { maxSide: 1280, quality: 0.6 },
  { maxSide: 1024, quality: 0.6 },
  { maxSide: 800, quality: 0.55 },
];

// Width and height scaled to fit inside maxSide, never enlarged.
export function fitWithin(width: number, height: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export async function compressImage(file: File, targetBytes = TARGET_BYTES): Promise<Blob> {
  // "from-image" applies the camera's rotation info, so photos aren't sideways.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => {
    throw new Error("This photo format isn't supported. Try a JPEG or PNG.");
  });

  try {
    let smallest: Blob | null = null;
    for (const { maxSide, quality } of ATTEMPTS) {
      const blob = await encode(bitmap, maxSide, quality);
      if (blob.size <= targetBytes) return blob;
      if (!smallest || blob.size < smallest.size) smallest = blob;
    }
    // Very detailed photo: use the smallest version we made.
    return smallest!;
  } finally {
    bitmap.close();
  }
}

function encode(bitmap: ImageBitmap, maxSide: number, quality: number): Promise<Blob> {
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxSide);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not process the photo.");
  context.drawImage(bitmap, 0, 0, width, height);

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not process the photo."))),
      "image/jpeg",
      quality,
    ),
  );
}
