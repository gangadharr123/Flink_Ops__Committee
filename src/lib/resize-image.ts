// Shrinks a phone photo before upload: longest side at most 1600 px, JPEG.
// A 4-8 MB camera photo becomes roughly 200-400 KB, which keeps uploads fast
// on hub Wi-Fi and the free 1 GB of Supabase Storage lasting.
// Browser only (uses canvas).
export async function resizeImage(
  file: File,
  maxSide = 1600,
  quality = 0.8,
): Promise<Blob> {
  // "from-image" applies the camera's rotation info, so photos aren't sideways.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => {
    throw new Error("This photo format isn't supported. Try a JPEG or PNG.");
  });

  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not process the photo.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not process the photo."))),
      "image/jpeg",
      quality,
    ),
  );
}
